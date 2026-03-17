import asyncio
import logging
from datetime import date

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
                continue  # keep approved/sent/skipped drafts untouched

            try:
                text, prompt = await generate_message(occ.contact, occ, today)
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
                )
                db.add(draft)
                created += 1

        db.commit()
        logger.info("daily_occasion_check: %d drafts created for %s", created, today)
        return created
    finally:
        if own_session:
            db.close()


def _run_daily_check():
    """Sync wrapper called by APScheduler."""
    asyncio.run(daily_occasion_check())


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
