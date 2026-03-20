import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import SessionLocal, get_db
from app.models.admin_setting import AdminSetting
from app.models.detected_occasion import DetectedOccasion
from app.models.occasion import Occasion
from app.models.whatsapp_target import WhatsAppTarget
from app.schemas.detected_occasion import DetectedOccasionOut, DetectionConfirmRequest, DetectionKeywordsOut, DetectionKeywordsUpdate, OccasionKeyword
from app.schemas.occasion import OccasionOut

router = APIRouter(prefix="/api/detections", tags=["detections"])
logger = logging.getLogger(__name__)

# In-memory scan state (single-user personal bot — no need for persistence)
_scan_state: dict = {"running": False, "scanned": 0, "detected": 0, "total": 0, "error": None}


def _get_setting(db: Session, key: str) -> str | None:
    row = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    return row.value if row else None


def _upsert_setting(db: Session, key: str, value: str) -> None:
    row = db.query(AdminSetting).filter(AdminSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AdminSetting(key=key, value=value))


@router.get("/keywords", response_model=DetectionKeywordsOut)
def get_keywords(db: Session = Depends(get_db)):
    """Return current detection keyword settings."""
    ignore_raw = _get_setting(db, "detection_ignore_keywords")
    occasion_raw = _get_setting(db, "detection_occasion_keywords")
    return DetectionKeywordsOut(
        ignore_keywords=json.loads(ignore_raw) if ignore_raw else [],
        occasion_keywords=[OccasionKeyword(**k) for k in json.loads(occasion_raw)] if occasion_raw else [],
    )


@router.put("/keywords", response_model=DetectionKeywordsOut)
def update_keywords(body: DetectionKeywordsUpdate, db: Session = Depends(get_db)):
    """Save detection keyword settings."""
    _upsert_setting(db, "detection_ignore_keywords", json.dumps([k.strip() for k in body.ignore_keywords if k.strip()]))
    _upsert_setting(db, "detection_occasion_keywords", json.dumps([k.model_dump() for k in body.occasion_keywords if k.keyword.strip()]))
    db.commit()
    return get_keywords(db)


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


@router.post("/dismiss-all")
def dismiss_all_detections(db: Session = Depends(get_db)):
    """Dismiss all pending detections at once."""
    count = (
        db.query(DetectedOccasion)
        .filter(DetectedOccasion.status == "pending")
        .update({"status": "dismissed"})
    )
    db.commit()
    return {"dismissed": count}


@router.delete("/history")
def delete_all_history(db: Session = Depends(get_db)):
    """Permanently delete ALL detection records (all statuses)."""
    count = db.query(DetectedOccasion).delete()
    db.commit()
    return {"deleted": count}
    return {"dismissed": count}


# ── Historical scan ───────────────────────────────────────────────────────────

class ScanHistoryRequest(BaseModel):
    chat_ids: Optional[list[str]] = None  # None = all chats
    limit_per_chat: int = 200


async def _run_scan(chat_ids: list[str], limit_per_chat: int) -> None:
    """
    Background task: fetch messages from each chat and run detection.

    All chats (group and 1:1) are processed message-by-message through the
    multi-step detection pipeline (process_message_for_occasion).
    """
    from app.services.whatsapp_service import get_chat_messages
    from app.services.occasion_detection_service import process_message_for_occasion

    global _scan_state
    _scan_state.update({"running": True, "scanned": 0, "detected": 0, "total": len(chat_ids), "error": None})

    for chat_id in chat_ids:
        if not _scan_state["running"]:
            break
        db = SessionLocal()
        try:
            chat_name, messages = await get_chat_messages(chat_id, limit=limit_per_chat)
            before = db.query(DetectedOccasion).count()

            for msg in messages:
                try:
                    await process_message_for_occasion(
                        chat_id, msg["id"], msg["body"], db,
                        timestamp=msg.get("timestamp"),
                        chat_name=chat_name,
                        sender_jid=msg.get("author"),
                        sender_name=msg.get("sender_name"),
                    )
                except Exception:
                    logger.exception("Detection error on message %s", msg.get("id"))

            after = db.query(DetectedOccasion).count()
            _scan_state["detected"] += after - before
            _scan_state["scanned"] += 1
        except Exception as e:
            logger.warning("Could not fetch messages from chat %s: %s", chat_id, e)
            _scan_state["scanned"] += 1
        finally:
            db.close()

    _scan_state["running"] = False
    logger.info(
        "History scan complete: %d chats, %d new detections",
        _scan_state["total"], _scan_state["detected"],
    )


@router.get("/scan-status")
def scan_status():
    """Return the current state of a history scan."""
    return _scan_state


@router.post("/scan-history")
async def scan_history(body: ScanHistoryRequest, background_tasks: BackgroundTasks):
    """
    Start a background scan of historical WhatsApp messages for occasion detection.
    If chat_ids is omitted, scans all available chats.
    """
    global _scan_state
    if _scan_state["running"]:
        raise HTTPException(status_code=409, detail="A scan is already running")

    from app.services.whatsapp_service import get_wa_chats

    if body.chat_ids:
        chat_ids = body.chat_ids
    else:
        chats = await get_wa_chats()
        chat_ids = [c["id"] for c in chats]

    if not chat_ids:
        raise HTTPException(status_code=400, detail="No chats available to scan")

    background_tasks.add_task(_run_scan, chat_ids, body.limit_per_chat)
    return {"status": "started", "total_chats": len(chat_ids)}
