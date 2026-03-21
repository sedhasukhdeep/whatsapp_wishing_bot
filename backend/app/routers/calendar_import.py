from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_profile
from app.models.contact import Contact
from app.models.occasion import Occasion
from app.models.profile import Profile
from app.schemas.calendar_import import (
    CalendarImportConfirmRequest,
    CalendarImportPreviewItem,
    CalendarImportResult,
)
from app.services.calendar_import_service import parse_ics_preview

router = APIRouter(prefix="/api/calendar", tags=["calendar"])

MAX_ICS_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/preview", response_model=list[CalendarImportPreviewItem])
async def preview_ics(
    file: UploadFile,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    """Upload a .ics file and preview what would be imported."""
    if not file.filename or not file.filename.lower().endswith(".ics"):
        raise HTTPException(status_code=400, detail="File must be a .ics file")
    if file.content_type not in ("text/calendar", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="File must have content type text/calendar")
    data = await file.read(MAX_ICS_SIZE + 1)
    if len(data) > MAX_ICS_SIZE:
        raise HTTPException(status_code=413, detail="File must be 5 MB or smaller")
    try:
        items = parse_ics_preview(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse ICS file: {e}")

    # Flag items whose name matches an existing contact in this profile
    for item in items:
        existing = (
            db.query(Contact)
            .filter(Contact.name.ilike(item.name), Contact.profile_id == profile.id)
            .first()
        )
        if existing:
            item.existing_contact_id = existing.id
            item.existing_contact_name = existing.name

    return items


@router.post("/confirm", response_model=CalendarImportResult)
def confirm_import(
    body: CalendarImportConfirmRequest,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    """Create contacts and occasions from the confirmed import list."""
    contacts_created = 0
    occasions_created = 0

    for item in body.items:
        if item.existing_contact_id:
            # Verify the contact belongs to this profile
            contact = db.query(Contact).filter(
                Contact.id == item.existing_contact_id, Contact.profile_id == profile.id
            ).first()
            contact_id = contact.id if contact else None
        else:
            contact_id = None

        if contact_id is None:
            new_contact = Contact(
                name=item.name,
                phone=item.phone,
                relationship=item.relationship,
                profile_id=profile.id,
            )
            db.add(new_contact)
            db.flush()
            contact_id = new_contact.id
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
