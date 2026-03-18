from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Contact, Occasion
from app.schemas.occasion import CalendarDayItem, CalendarOccasionEntry, OccasionCreate, OccasionOut, OccasionUpdate

router = APIRouter(prefix="/api/occasions", tags=["occasions"])


@router.get("", response_model=list[OccasionOut])
def list_occasions(contact_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Occasion)
    if contact_id:
        q = q.filter(Occasion.contact_id == contact_id)
    return q.order_by(Occasion.month, Occasion.day).all()


@router.get("/calendar", response_model=list[CalendarDayItem])
def get_calendar(month: int, year: int, db: Session = Depends(get_db)):
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="month must be 1–12")

    occasions = (
        db.query(Occasion)
        .options(joinedload(Occasion.contact))
        .filter(Occasion.month == month, Occasion.active == True)  # noqa: E712
        .all()
    )

    grouped: dict[int, list[CalendarOccasionEntry]] = defaultdict(list)
    for occ in occasions:
        grouped[occ.day].append(
            CalendarOccasionEntry(
                contact_id=occ.contact_id,
                contact_name=occ.contact.name,
                occasion_id=occ.id,
                type=occ.type,
                label=occ.label,
            )
        )

    return [
        CalendarDayItem(day=day, occasions=entries)
        for day, entries in sorted(grouped.items())
    ]


@router.post("", response_model=OccasionOut, status_code=201)
def create_occasion(body: OccasionCreate, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == body.contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    occasion = Occasion(**body.model_dump())
    db.add(occasion)
    db.commit()
    db.refresh(occasion)
    return occasion


@router.put("/{occasion_id}", response_model=OccasionOut)
def update_occasion(occasion_id: int, body: OccasionUpdate, db: Session = Depends(get_db)):
    occasion = db.query(Occasion).filter(Occasion.id == occasion_id).first()
    if not occasion:
        raise HTTPException(status_code=404, detail="Occasion not found")
    for field, value in body.model_dump().items():
        setattr(occasion, field, value)
    db.commit()
    db.refresh(occasion)
    return occasion


@router.delete("/{occasion_id}", status_code=204)
def delete_occasion(occasion_id: int, db: Session = Depends(get_db)):
    occasion = db.query(Occasion).filter(Occasion.id == occasion_id).first()
    if not occasion:
        raise HTTPException(status_code=404, detail="Occasion not found")
    db.delete(occasion)
    db.commit()
