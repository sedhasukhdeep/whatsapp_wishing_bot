import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.detected_occasion import DetectedOccasion
from app.models.occasion import Occasion
from app.models.whatsapp_target import WhatsAppTarget
from app.schemas.detected_occasion import DetectedOccasionOut, DetectionConfirmRequest
from app.schemas.occasion import OccasionOut

router = APIRouter(prefix="/api/detections", tags=["detections"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[DetectedOccasionOut])
def list_detections(db: Session = Depends(get_db)):
    """Return all pending detections, newest first."""
    return (
        db.query(DetectedOccasion)
        .options(joinedload(DetectedOccasion.matched_contact))
        .filter(DetectedOccasion.status == "pending")
        .order_by(DetectedOccasion.created_at.desc())
        .all()
    )


@router.get("/count")
def detections_count(db: Session = Depends(get_db)):
    """Return count of pending detections (for nav badge)."""
    count = db.query(DetectedOccasion).filter(DetectedOccasion.status == "pending").count()
    return {"count": count}


@router.post("/{detection_id}/confirm", response_model=OccasionOut)
def confirm_detection(
    detection_id: int,
    body: DetectionConfirmRequest,
    db: Session = Depends(get_db),
):
    """
    Confirm a detection: creates an Occasion on the chosen contact.
    If the detection came from a group chat different from the contact's personal chat,
    auto-creates/upserts a WhatsAppTarget and links it as the occasion's source_target_id.
    """
    from app.models.contact import Contact

    detection = db.get(DetectedOccasion, detection_id)
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    if detection.status != "pending":
        raise HTTPException(status_code=400, detail="Detection already processed")

    contact = db.get(Contact, body.contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    # Determine if we need a dynamic WhatsApp target (group chat differs from contact's chat)
    source_target_id = None
    source_chat_id = detection.source_chat_id
    if source_chat_id.endswith("@g.us") and source_chat_id != contact.whatsapp_chat_id:
        # Upsert WhatsAppTarget for this group
        target = db.query(WhatsAppTarget).filter(WhatsAppTarget.chat_id == source_chat_id).first()
        if not target:
            chat_name = detection.source_chat_name or source_chat_id
            target = WhatsAppTarget(
                name=chat_name[:100],
                chat_id=source_chat_id,
                target_type="group",
                description=f"Auto-created from occasion detection for {contact.name}",
            )
            db.add(target)
            db.flush()  # get id before commit
        source_target_id = target.id

    occasion = Occasion(
        contact_id=body.contact_id,
        type=body.occasion_type,
        label=body.label,
        month=body.month,
        day=body.day,
        year=body.year,
        active=True,
        source_target_id=source_target_id,
    )
    db.add(occasion)
    db.flush()

    detection.status = "confirmed"
    detection.created_occasion_id = occasion.id
    db.commit()
    db.refresh(occasion)

    logger.info(
        "Confirmed detection %d → occasion %d for contact %d (source_target_id=%s)",
        detection_id, occasion.id, body.contact_id, source_target_id,
    )
    return occasion


@router.post("/{detection_id}/dismiss")
def dismiss_detection(detection_id: int, db: Session = Depends(get_db)):
    """Mark a detection as dismissed."""
    detection = db.get(DetectedOccasion, detection_id)
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    detection.status = "dismissed"
    db.commit()
    return {"ok": True}
