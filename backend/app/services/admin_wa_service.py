import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session, selectinload

from app.models import MessageDraft, Occasion
from app.models.admin_setting import AdminSetting

logger = logging.getLogger(__name__)


def get_setting(db: Session, key: str) -> str | None:
    row = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    return row.value if row else None


def get_admin_chat_id(db: Session) -> str | None:
    return get_setting(db, "admin_wa_chat_id")


def parse_command(text: str) -> tuple[str, list[str]]:
    parts = text.strip().lower().split()
    if not parts:
        return "", []
    return parts[0], parts[1:]


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

    lines.append("Commands: approve <id> · send <id> · skip <id>")
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


async def send_admin_notification(db: Session, occasions: list, today: date) -> None:
    """Send today + upcoming summary to admin WhatsApp chat after daily draft generation."""
    from app.services.whatsapp_service import send_whatsapp_message

    admin_chat_id = get_setting(db, "admin_wa_chat_id")
    enabled = get_setting(db, "admin_notifications_enabled") == "true"
    if not admin_chat_id or not enabled:
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
        await send_whatsapp_message(admin_chat_id, today_msg)
    except Exception as e:
        logger.warning("Failed to send today admin notification: %s", e)

    # Upcoming
    upcoming = []
    for delta in range(1, 8):
        target = today + timedelta(days=delta)
        upcoming_occasions = (
            db.query(Occasion)
            .options(selectinload(Occasion.contact))
            .filter(
                Occasion.month == target.month,
                Occasion.day == target.day,
                Occasion.active == True,  # noqa: E712
            )
            .all()
        )
        for u_occ in upcoming_occasions:
            upcoming.append((u_occ, u_occ.contact, delta))

    if upcoming:
        upcoming_msg = format_upcoming_notification(upcoming)
        try:
            await send_whatsapp_message(admin_chat_id, upcoming_msg)
        except Exception as e:
            logger.warning("Failed to send upcoming admin notification: %s", e)


async def handle_command(command: str, args: list[str], db: Session) -> str:
    today = date.today()

    if command == "help":
        return (
            "Available commands:\n"
            "• list — today's drafts\n"
            "• approve <id> — approve draft\n"
            "• send <id> — approve and send\n"
            "• skip <id> — skip draft\n"
            "• regenerate <id> — regenerate draft text\n"
            "• upcoming — next 7 days\n"
            "• help — this message"
        )

    if command == "list":
        occasions = (
            db.query(Occasion)
            .options(selectinload(Occasion.contact))
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
                db.query(Occasion)
                .options(selectinload(Occasion.contact))
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
                await send_whatsapp_message(chat_id, final_text)
            except Exception as e:
                return f"Send failed: {e}"

            draft.final_text = final_text
            draft.status = "sent"
            draft.sent_at = datetime.now(timezone.utc)
            db.commit()
            return f"✓ Draft #{draft_id} sent to {contact.name if contact else chat_id}."

        if command == "regenerate":
            from app.services.claude_service import generate_message

            try:
                new_text, prompt = await generate_message(draft.contact, draft.occasion, draft.occasion_date, db=db)
            except Exception as e:
                return f"Regeneration failed: {e}"

            draft.generated_text = new_text
            draft.edited_text = None
            draft.generation_prompt = prompt
            draft.status = "pending"
            db.commit()

            preview = new_text[:150] + "…" if len(new_text) > 150 else new_text
            return f"✓ Draft #{draft_id} regenerated:\n\"{preview}\""

    return "Unknown command. Type 'help'."
