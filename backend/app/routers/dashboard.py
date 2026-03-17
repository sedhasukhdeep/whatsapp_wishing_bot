from datetime import date, timedelta

import pytz
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import get_db
from app.models import MessageDraft, Occasion
from app.schemas.message_draft import DashboardOccasionItem, DashboardUpcomingItem
from app.services.occasion_service import compute_age, compute_years

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _get_today() -> date:
    tz = pytz.timezone(settings.scheduler_timezone)
    return date.today()  # host local date — good enough for personal use


@router.get("/today", response_model=list[DashboardOccasionItem])
def dashboard_today(db: Session = Depends(get_db)):
    today = _get_today()
    occasions = (
        db.query(Occasion)
        .options(selectinload(Occasion.contact))
        .filter(Occasion.month == today.month, Occasion.day == today.day, Occasion.active == True)  # noqa: E712
        .all()
    )
    result = []
    for occ in occasions:
        draft = (
            db.query(MessageDraft)
            .filter(MessageDraft.occasion_id == occ.id, MessageDraft.occasion_date == today)
            .first()
        )
        result.append(
            DashboardOccasionItem(
                occasion=occ,
                contact=occ.contact,
                draft=draft,
                turning_age=compute_age(occ, today),
                years_together=compute_years(occ, today),
            )
        )
    return result


@router.get("/upcoming", response_model=list[DashboardUpcomingItem])
def dashboard_upcoming(db: Session = Depends(get_db)):
    today = _get_today()
    result = []
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
            result.append(
                DashboardUpcomingItem(
                    occasion=occ,
                    contact=occ.contact,
                    days_away=delta,
                    turning_age=compute_age(occ, target),
                    years_together=compute_years(occ, target),
                )
            )
    return result


@router.post("/generate")
async def manual_generate(db: Session = Depends(get_db)):
    from app.scheduler import daily_occasion_check

    try:
        count = await daily_occasion_check(db)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return {"drafts_created": count}
