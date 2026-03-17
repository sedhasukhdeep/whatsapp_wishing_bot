from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Contact, Occasion
from app.schemas.occasion import OccasionCreate, OccasionOut, OccasionUpdate

router = APIRouter(prefix="/api/occasions", tags=["occasions"])


@router.get("", response_model=list[OccasionOut])
def list_occasions(contact_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Occasion)
    if contact_id:
        q = q.filter(Occasion.contact_id == contact_id)
    return q.order_by(Occasion.month, Occasion.day).all()


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
