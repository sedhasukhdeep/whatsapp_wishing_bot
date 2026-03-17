from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Contact
from app.schemas.contact import ContactCreate, ContactOut, ContactUpdate, ContactWithOccasions

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("", response_model=list[ContactOut])
def list_contacts(search: str = "", relationship: str = "", db: Session = Depends(get_db)):
    q = db.query(Contact)
    if search:
        q = q.filter(or_(Contact.name.ilike(f"%{search}%"), Contact.phone.ilike(f"%{search}%")))
    if relationship:
        q = q.filter(Contact.relationship == relationship)
    return q.order_by(Contact.name).all()


@router.post("", response_model=ContactOut, status_code=201)
def create_contact(body: ContactCreate, db: Session = Depends(get_db)):
    contact = Contact(**body.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=ContactWithOccasions)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = (
        db.query(Contact)
        .options(selectinload(Contact.occasions))
        .filter(Contact.id == contact_id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: int, body: ContactUpdate, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for field, value in body.model_dump().items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
