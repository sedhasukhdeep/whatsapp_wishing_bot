from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contact import Contact
from app.models.occasion import Occasion
from app.schemas.calendar_import import (
    CalendarImportConfirmRequest,
    CalendarImportPreviewItem,
    CalendarImportResult,
)
from app.services.calendar_import_service import parse_ics_preview

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.post("/preview", response_model=list[CalendarImportPreviewItem])
async def preview_ics(file: UploadFile, db: Session = Depends(get_db)):
    """Upload a .ics file and preview what would be imported."""
    if not file.filename or not file.filename.lower().endswith(".ics"):
        raise HTTPException(status_code=400, detail="File must be a .ics file")
    data = await file.read()
    try:
        items = parse_ics_preview(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse ICS file: {e}")

    # Flag items whose name matches an existing contact
    for item in items:
        existing = db.query(Contact).filter(Contact.name.ilike(item.name)).first()
        if existing:
            item.existing_contact_id = existing.id
            item.existing_contact_name = existing.name

    return items


@router.post("/confirm", response_model=CalendarImportResult)
def confirm_import(body: CalendarImportConfirmRequest, db: Session = Depends(get_db)):
    """Create contacts and occasions from the confirmed import list."""
    contacts_created = 0
    occasions_created = 0

    for item in body.items:
        if item.existing_contact_id:
            contact_id = item.existing_contact_id
        else:
            contact = Contact(
                name=item.name,
                phone=item.phone,
                relationship=item.relationship,
            )
            db.add(contact)
            db.flush()
            contact_id = contact.id
            contacts_created += 1

        # Skip if this exact occasion already exists for this contact
        existing_occ = (
            db.query(Occasion)
            .filter(
                Occasion.contact_id == contact_id,
                Occasion.type == item.occasion_type,
                Occasion.month == item.month,
                Occasion.day == item.day,
            )
            .first()
        )
        if existing_occ:
            continue

        occ = Occasion(
            contact_id=contact_id,
            type=item.occasion_type,
            label=item.label,
            month=item.month,
            day=item.day,
            year=item.year,
            active=True,
        )
        db.add(occ)
        occasions_created += 1

    db.commit()
    return CalendarImportResult(contacts_created=contacts_created, occasions_created=occasions_created)
