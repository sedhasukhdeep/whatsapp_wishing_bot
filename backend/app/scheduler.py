import asyncio
import logging
from datetime import date, datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import SessionLocal
from app.models import MessageDraft, Occasion

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


async def daily_occasion_check(db: Session | None = None) -> int:
    """Generate pending drafts for today's occasions. Returns count of new drafts created."""
    from app.services.claude_service import generate_message

    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        today = date.today()
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

        created = 0
        for occ in occasions:
            existing = (
                db.query(MessageDraft)
                .filter(MessageDraft.occasion_id == occ.id, MessageDraft.occasion_date == today)
                .first()
            )
            if existing and existing.status != "pending":
                continue  # keep approved/sent/skipped/scheduled drafts untouched

            try:
                text, prompt = await generate_message(occ.contact, occ, today, db=db)
            except Exception as e:
                logger.exception("Claude generation failed for occasion %d", occ.id)
                raise RuntimeError(str(e)) from e

            if existing:
                existing.generated_text = text
                existing.generation_prompt = prompt
            else:
                draft = MessageDraft(
                    occasion_id=occ.id,
                    contact_id=occ.contact_id,
                    occasion_date=today,
                    generated_text=text,
                    generation_prompt=prompt,
                    status="pending",
                    whatsapp_target_id=occ.source_target_id,
                )
                db.add(draft)
                created += 1

        db.commit()
        logger.info("daily_occasion_check: %d drafts created for %s", created, today)

        # Send admin notification (best-effort)
        try:
            from app.services.admin_wa_service import send_admin_notification
            await send_admin_notification(db, occasions, today)
        except Exception:
            logger.exception("Failed to send admin WA notification")

        return created
    finally:
        if own_session:
            db.close()


async def process_scheduled_drafts(db: Session | None = None) -> int:
    """Send any drafts that are scheduled and due. Returns count sent."""
    from app.services.whatsapp_service import send_whatsapp_message

    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        now = datetime.now(timezone.utc)
        drafts = (
            db.query(MessageDraft)
            .options(selectinload(MessageDraft.contact))
            .filter(
                MessageDraft.status == "scheduled",
                MessageDraft.scheduled_for <= now,
            )
            .all()
        )

        sent = 0
        for draft in drafts:
            contact = draft.contact
            # Prefer the draft's whatsapp_target (e.g. detected group) over the contact's personal chat
            if draft.whatsapp_target_id:
                from app.models.whatsapp_target import WhatsAppTarget
                target = db.get(WhatsAppTarget, draft.whatsapp_target_id)
                send_chat_id = target.chat_id if target else (contact.whatsapp_chat_id if contact else None)
            else:
                send_chat_id = contact.whatsapp_chat_id if contact else None
            if not send_chat_id:
                logger.warning("Scheduled draft %d has no WhatsApp chat — skipping", draft.id)
                continue
            try:
                final_text = draft.edited_text or draft.generated_text
                await send_whatsapp_message(send_chat_id, final_text)
                draft.final_text = final_text
                draft.status = "sent"
                draft.sent_at = datetime.now(timezone.utc)
                db.commit()
                sent += 1
            except Exception:
                logger.exception("Failed to send scheduled draft %d", draft.id)
                db.rollback()

        if sent:
            logger.info("process_scheduled_drafts: sent %d scheduled drafts", sent)
        return sent
    finally:
        if own_session:
            db.close()


def _run_daily_check():
    """Sync wrapper called by APScheduler."""
    asyncio.run(daily_occasion_check())


def _run_scheduled_drafts():
    """Sync wrapper called by APScheduler."""
    asyncio.run(process_scheduled_drafts())


def start_scheduler():
    scheduler.add_job(
        func=_run_daily_check,
        trigger=CronTrigger(
            hour=settings.scheduler_hour,
            minute=settings.scheduler_minute,
            timezone=settings.scheduler_timezone,
        ),
        id="daily_check",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        func=_run_scheduled_drafts,
        trigger="interval",
        minutes=1,
        id="scheduled_drafts",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started — daily check at %02d:%02d %s",
        settings.scheduler_hour,
        settings.scheduler_minute,
        settings.scheduler_timezone,
    )


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
