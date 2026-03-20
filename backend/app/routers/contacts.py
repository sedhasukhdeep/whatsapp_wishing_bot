from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Contact
from app.schemas.contact import (
    BulkTagRequest,
    BulkTagResult,
    ContactCreate,
    ContactOut,
    ContactUpdate,
    ContactWithOccasions,
    GroupTagPreviewItem,
    WaSyncImportRequest,
    WaSyncImportResult,
    WaSyncPreviewItem,
)
from app.services.whatsapp_service import get_group_members, get_wa_contacts

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("/wa-sync/preview", response_model=list[WaSyncPreviewItem])
async def wa_sync_preview(db: Session = Depends(get_db)):
    wa_contacts = await get_wa_contacts()
    existing = db.query(Contact.phone, Contact.id).all()
    existing_phones = {row.phone: row.id for row in existing}
    result = []
    for c in wa_contacts:
        already_exists = c["phone"] in existing_phones
        result.append(
            WaSyncPreviewItem(
                phone=c["phone"],
                name=c["name"],
                chat_id=c["chat_id"],
                already_exists=already_exists,
                existing_contact_id=existing_phones.get(c["phone"]),
            )
        )
    return result


@router.post("/wa-sync/import", response_model=WaSyncImportResult)
async def wa_sync_import(body: WaSyncImportRequest, db: Session = Depends(get_db)):
    existing_phones = {row.phone for row in db.query(Contact.phone).all()}
    created = 0
    skipped = 0
    for item in body.items:
        if item.phone in existing_phones:
            skipped += 1
            continue
        contact = Contact(
            name=item.name,
            phone=item.phone,
            relationship=item.relationship,
            whatsapp_chat_id=item.chat_id,
            whatsapp_chat_name=item.name,
        )
        db.add(contact)
        existing_phones.add(item.phone)
        created += 1
    db.commit()
    return WaSyncImportResult(created=created, skipped=skipped)


@router.get("/group-tag-preview", response_model=list[GroupTagPreviewItem])
async def group_tag_preview(group_id: str, db: Session = Depends(get_db)):
    data = await get_group_members(group_id)
    participants = data.get("participants", [])
    contacts = db.query(Contact).all()
    phone_to_contact = {c.phone: c for c in contacts}
    result = []
    for p in participants:
        contact = phone_to_contact.get(p["phone"])
        if contact:
            result.append(
                GroupTagPreviewItem(
                    contact_id=contact.id,
                    name=contact.name,
                    phone=contact.phone,
                    current_relationship=contact.relationship,
                )
            )
    return result


@router.post("/bulk-tag", response_model=BulkTagResult)
def bulk_tag_contacts(body: BulkTagRequest, db: Session = Depends(get_db)):
    if not body.contact_ids:
        return BulkTagResult(updated=0)
    updated = (
        db.query(Contact)
        .filter(Contact.id.in_(body.contact_ids))
        .update({"relationship": body.relationship}, synchronize_session=False)
    )
    db.commit()
    return BulkTagResult(updated=updated)


@router.delete("", status_code=200)
def delete_all_contacts(db: Session = Depends(get_db)):
    deleted = db.query(Contact).delete()
    db.commit()
    return {"deleted": deleted}


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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"A contact with phone {body.phone} already exists",
        )
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"A contact with phone {body.phone} already exists",
        )
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
