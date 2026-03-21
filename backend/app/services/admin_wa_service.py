import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session, selectinload

from app.models import Contact, MessageDraft, Occasion
from app.models.admin_setting import AdminSetting

logger = logging.getLogger(__name__)


def get_setting(db: Session, key: str) -> str | None:
    row = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    return row.value if row else None


def get_admin_chat_id(db: Session) -> str | None:
    return get_setting(db, "admin_wa_chat_id")


def parse_command(text: str) -> tuple[str, list[str]]:
    stripped = text.strip()
    if not stripped:
        return "", []
    parts = stripped.split()
    # Only lowercase the command word; preserve original case in args so regenerate
    # context text is not mangled.
    return parts[0].lower(), parts[1:]


def format_today_notification(occasions_with_drafts: list, today: date) -> str:
    """occasions_with_drafts: list of (occasion, contact, draft | None)"""
    date_str = today.strftime("%d %b %Y")
    if not occasions_with_drafts:
        return f"No occasions today ({date_str})."

    lines = [f"🎉 Today's Occasions — {date_str}\n"]
    for i, (occ, contact, draft) in enumerate(occasions_with_drafts, 1):
        if occ.type == "birthday":
            emoji, occ_label = "🎂", "Birthday"
        elif occ.type == "anniversary":
            emoji, occ_label = "💍", "Anniversary"
        else:
            emoji, occ_label = "🎊", occ.label or "Occasion"

        draft_id = f"#{draft.id}" if draft else "no draft"
        draft_text = (draft.edited_text or draft.generated_text) if draft else "(not generated)"
        if len(draft_text) > 120:
            draft_text = draft_text[:120] + "…"
        status = draft.status if draft else "–"

        lines.append(f"{i}. [{draft_id}] {contact.name} — {occ_label} {emoji}")
        lines.append(f'"{draft_text}"')
        lines.append(f"Status: {status}\n")

    lines.append("Commands: approve <id> · send <id> · skip <id> · regenerate <id> [context]")
    lines.append("Type 'help' for all commands")
    return "\n".join(lines)


def format_upcoming_notification(upcoming: list) -> str:
    """upcoming: list of (occasion, contact, days_away)"""
    if not upcoming:
        return "No upcoming occasions in the next 7 days."

    lines = ["📅 Upcoming (next 7 days)\n"]
    for occ, contact, days_away in upcoming:
        if occ.type == "birthday":
            label = "Birthday"
        elif occ.type == "anniversary":
            label = "Anniversary"
        else:
            label = occ.label or "Occasion"

        day_str = "Tomorrow" if days_away == 1 else f"In {days_away} days"
        lines.append(f"• {day_str}: {contact.name} — {label}")

    return "\n".join(lines)


async def send_admin_notification(
    db: Session, occasions: list, today: date, profile_id: int | None = None
) -> None:
    """Send today + upcoming summary to the profile's admin WhatsApp chat."""
    from app.services.whatsapp_service import send_whatsapp_message

    # Resolve admin chat from profile (preferred) or legacy AdminSetting
    admin_chat_id: str | None = None
    if profile_id is not None:
        from app.models.profile import Profile
        p = db.get(Profile, profile_id)
        if p and p.wa_admin_chat_id and p.notifications_enabled:
            admin_chat_id = p.wa_admin_chat_id
    if not admin_chat_id:
        admin_chat_id = get_setting(db, "admin_wa_chat_id")
        if not (admin_chat_id and get_setting(db, "admin_notifications_enabled") == "true"):
            return

    if not admin_chat_id:
        return

    # Build (occasion, contact, draft) list for today
    items = []
    for occ in occasions:
        draft = (
            db.query(MessageDraft)
            .filter(MessageDraft.occasion_id == occ.id, MessageDraft.occasion_date == today)
            .first()
        )
        items.append((occ, occ.contact, draft))

    today_msg = format_today_notification(items, today)
    try:
        await send_whatsapp_message(admin_chat_id, today_msg, profile_id=profile_id)
    except Exception as e:
        logger.warning("Failed to send today admin notification: %s", e)

    # Upcoming — scoped to profile if provided
    upcoming = []
    for delta in range(1, 8):
        target = today + timedelta(days=delta)
        q = (
            db.query(Occasion)
            .options(selectinload(Occasion.contact))
            .join(Contact)
            .filter(
                Occasion.month == target.month,
                Occasion.day == target.day,
                Occasion.active == True,  # noqa: E712
            )
        )
        if profile_id is not None:
            q = q.filter(Contact.profile_id == profile_id)
        for u_occ in q.all():
            upcoming.append((u_occ, u_occ.contact, delta))

    if upcoming:
        upcoming_msg = format_upcoming_notification(upcoming)
        try:
            await send_whatsapp_message(admin_chat_id, upcoming_msg, profile_id=profile_id)
        except Exception as e:
            logger.warning("Failed to send upcoming admin notification: %s", e)


async def handle_command(command: str, args: list[str], db: Session, profile_id: int | None = None) -> str:
    today = date.today()

    def _occasions_query():
        q = (
            db.query(Occasion)
            .options(selectinload(Occasion.contact))
            .join(Contact)
        )
        if profile_id is not None:
            q = q.filter(Contact.profile_id == profile_id)
        return q

    if command == "help":
        return (
            "Available commands:\n"
            "• list — today's drafts\n"
            "• approve <id> — approve draft\n"
            "• send <id> — approve and send\n"
            "• skip <id> — skip draft\n"
            "• regenerate <id> [context] — regenerate draft text\n"
            "  e.g. regenerate #3 make it funnier and mention our trip\n"
            "• upcoming — next 7 days\n"
            "• help — this message"
        )

    if command == "list":
        occasions = (
            _occasions_query()
            .filter(
                Occasion.month == today.month,
                Occasion.day == today.day,
                Occasion.active == True,  # noqa: E712
            )
            .all()
        )
        items = []
        for occ in occasions:
            draft = (
                db.query(MessageDraft)
                .filter(MessageDraft.occasion_id == occ.id, MessageDraft.occasion_date == today)
                .first()
            )
            items.append((occ, occ.contact, draft))
        return format_today_notification(items, today)

    if command == "upcoming":
        upcoming = []
        for delta in range(1, 8):
            target = today + timedelta(days=delta)
            occasions = (
                _occasions_query()
                .filter(
                    Occasion.month == target.month,
                    Occasion.day == target.day,
                    Occasion.active == True,  # noqa: E712
                )
                .all()
            )
            for occ in occasions:
                upcoming.append((occ, occ.contact, delta))
        return format_upcoming_notification(upcoming)

    if command in ("approve", "send", "skip", "regenerate"):
        if not args:
            return f"Usage: {command} <draft_id>"
        try:
            draft_id = int(args[0].lstrip("#"))
        except ValueError:
            return f"Invalid draft ID: {args[0]}"

        draft = db.query(MessageDraft).filter(MessageDraft.id == draft_id).first()
        if not draft:
            return f"Draft #{draft_id} not found."

        if command == "skip":
            if draft.status == "sent":
                return f"Draft #{draft_id} is already sent."
            draft.status = "skipped"
            db.commit()
            return f"✓ Draft #{draft_id} skipped."

        if command == "approve":
            if draft.status == "sent":
                return f"Draft #{draft_id} is already sent."
            draft.status = "approved"
            db.commit()
            return f"✓ Draft #{draft_id} approved."

        if command == "send":
            if draft.status == "sent":
                return f"Draft #{draft_id} is already sent."

            from app.models import WhatsAppTarget
            from app.services.whatsapp_service import send_whatsapp_message

            chat_id = None
            contact = draft.contact
            if contact and contact.whatsapp_chat_id:
                chat_id = contact.whatsapp_chat_id
            elif draft.whatsapp_target_id:
                target = db.query(WhatsAppTarget).filter(WhatsAppTarget.id == draft.whatsapp_target_id).first()
                if target:
                    chat_id = target.chat_id

            if not chat_id:
                return f"Draft #{draft_id}: no WhatsApp chat linked to contact or target."

            final_text = draft.edited_text or draft.generated_text
            try:
                await send_whatsapp_message(chat_id, final_text, profile_id=profile_id)
            except Exception as e:
                return f"Send failed: {e}"

            draft.final_text = final_text
            draft.status = "sent"
            draft.sent_at = datetime.now(timezone.utc)
            db.commit()
            return f"✓ Draft #{draft_id} sent to {contact.name if contact else chat_id}."

        if command == "regenerate":
            from app.services.claude_service import generate_message

            # args[1:] is the optional free-text context, e.g.
            # "regenerate #3 make it funnier and mention our trip to Paris"
            extra_context = " ".join(args[1:]) if len(args) > 1 else None

            try:
                new_text, prompt = await generate_message(
                    draft.contact, draft.occasion, draft.occasion_date,
                    db=db, extra_context=extra_context,
                )
            except Exception as e:
                return f"Regeneration failed: {e}"

            draft.generated_text = new_text
            draft.edited_text = None
            draft.generation_prompt = prompt
            draft.status = "pending"
            db.commit()

            preview = new_text[:150] + "…" if len(new_text) > 150 else new_text
            context_note = f" (context: {extra_context[:60]})" if extra_context else ""
            return f"✓ Draft #{draft_id} regenerated{context_note}:\n\"{preview}\""

    return "Unknown command. Type 'help'."
