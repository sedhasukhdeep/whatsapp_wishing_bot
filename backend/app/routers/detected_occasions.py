import asyncio
import json
import logging
import threading
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import SessionLocal, get_db
from app.dependencies import get_current_profile
from app.models.admin_setting import AdminSetting
from app.models.detected_occasion import DetectedOccasion
from app.models.occasion import Occasion
from app.models.profile import Profile
from app.models.whatsapp_target import WhatsAppTarget
from app.schemas.detected_occasion import DetectedOccasionOut, DetectionConfirmRequest, DetectionKeywordsOut, DetectionKeywordsUpdate, OccasionKeyword
from app.schemas.occasion import OccasionOut

router = APIRouter(prefix="/api/detections", tags=["detections"])
logger = logging.getLogger(__name__)

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
    ignore_raw = _get_setting(db, "detection_ignore_keywords")
    occasion_raw = _get_setting(db, "detection_occasion_keywords")
    return DetectionKeywordsOut(
        ignore_keywords=json.loads(ignore_raw) if ignore_raw else [],
        occasion_keywords=[OccasionKeyword(**k) for k in json.loads(occasion_raw)] if occasion_raw else [],
    )


@router.put("/keywords", response_model=DetectionKeywordsOut)
def update_keywords(body: DetectionKeywordsUpdate, db: Session = Depends(get_db)):
    _upsert_setting(db, "detection_ignore_keywords", json.dumps([k.strip() for k in body.ignore_keywords if k.strip()]))
    _upsert_setting(db, "detection_occasion_keywords", json.dumps([k.model_dump() for k in body.occasion_keywords if k.keyword.strip()]))
    db.commit()
    return get_keywords(db)


@router.get("", response_model=list[DetectedOccasionOut])
def list_detections(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    return (
        db.query(DetectedOccasion)
        .options(joinedload(DetectedOccasion.matched_contact))
        .filter(DetectedOccasion.status == "pending", DetectedOccasion.profile_id == profile.id)
        .order_by(DetectedOccasion.created_at.desc())
        .all()
    )


@router.get("/count")
def detections_count(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    count = db.query(DetectedOccasion).filter(
        DetectedOccasion.status == "pending", DetectedOccasion.profile_id == profile.id
    ).count()
    return {"count": count}


@router.post("/{detection_id}/confirm", response_model=OccasionOut)
def confirm_detection(
    detection_id: int,
    body: DetectionConfirmRequest,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    from app.models.contact import Contact

    detection = db.get(DetectedOccasion, detection_id)
    if not detection:
        raise HTTPException(status_code=404, detail="Detection not found")
    if detection.profile_id != profile.id:
        raise HTTPException(status_code=403, detail="Detection not found")
    if detection.status != "pending":
        raise HTTPException(status_code=400, detail="Detection already processed")

    contact = db.query(Contact).filter(Contact.id == body.contact_id, Contact.profile_id == profile.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    source_target_id = None
    source_chat_id = detection.source_chat_id
    if source_chat_id.endswith("@g.us") and source_chat_id != contact.whatsapp_chat_id:
        target = db.query(WhatsAppTarget).filter(
            WhatsAppTarget.chat_id == source_chat_id, WhatsAppTarget.profile_id == profile.id
        ).first()
        if not target:
            chat_name = detection.source_chat_name or source_chat_id
            target = WhatsAppTarget(
                profile_id=profile.id,
                name=chat_name[:100],
                chat_id=source_chat_id,
                target_type="group",
                description=f"Auto-created from occasion detection for {contact.name}",
            )
            db.add(target)
            db.flush()
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
    return occasion


@router.post("/{detection_id}/dismiss")
def dismiss_detection(
    detection_id: int,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    detection = db.get(DetectedOccasion, detection_id)
    if not detection or detection.profile_id != profile.id:
        raise HTTPException(status_code=404, detail="Detection not found")
    detection.status = "dismissed"
    db.commit()
    return {"ok": True}


@router.post("/dismiss-all")
def dismiss_all_detections(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    count = (
        db.query(DetectedOccasion)
        .filter(DetectedOccasion.status == "pending", DetectedOccasion.profile_id == profile.id)
        .update({"status": "dismissed"})
    )
    db.commit()
    return {"dismissed": count}


@router.delete("/history")
def delete_all_history(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    count = db.query(DetectedOccasion).filter(DetectedOccasion.profile_id == profile.id).delete()
    db.commit()
    return {"deleted": count}


# ── Historical scan ───────────────────────────────────────────────────────────

class ScanHistoryRequest(BaseModel):
    chat_ids: Optional[list[str]] = None
    limit_per_chat: int = 200


def _start_scan_thread(chat_ids: list[str], limit_per_chat: int, profile_id: int) -> None:
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_run_scan(chat_ids, limit_per_chat, profile_id))
    finally:
        loop.close()


async def _run_scan(chat_ids: list[str], limit_per_chat: int, profile_id: int) -> None:
    from app.services.whatsapp_service import get_chat_messages
    from app.services.occasion_detection_service import process_message_for_occasion

    global _scan_state
    _scan_state.update({"running": True, "scanned": 0, "detected": 0, "total": len(chat_ids), "error": None})

    for chat_id in chat_ids:
        if not _scan_state["running"]:
            break
        db = SessionLocal()
        try:
            chat_name, messages = await get_chat_messages(chat_id, limit=limit_per_chat, profile_id=profile_id)
            before = db.query(DetectedOccasion).filter(DetectedOccasion.profile_id == profile_id).count()

            for msg in messages:
                try:
                    await process_message_for_occasion(
                        chat_id, msg["id"], msg["body"], db,
                        timestamp=msg.get("timestamp"),
                        chat_name=chat_name,
                        sender_jid=msg.get("author"),
                        sender_name=msg.get("sender_name"),
                        profile_id=profile_id,
                    )
                except Exception:
                    logger.exception("Detection error on message %s", msg.get("id"))

            after = db.query(DetectedOccasion).filter(DetectedOccasion.profile_id == profile_id).count()
            _scan_state["detected"] += after - before
            _scan_state["scanned"] += 1
        except Exception as e:
            logger.warning("Could not fetch messages from chat %s: %s", chat_id, e)
            _scan_state["scanned"] += 1
        finally:
            db.close()

    _scan_state["running"] = False
    logger.info("History scan complete: %d chats, %d new detections", _scan_state["total"], _scan_state["detected"])


@router.get("/scan-status")
def scan_status():
    return _scan_state


@router.post("/scan-history")
async def scan_history(
    body: ScanHistoryRequest,
    profile: Profile = Depends(get_current_profile),
):
    global _scan_state
    if _scan_state["running"]:
        raise HTTPException(status_code=409, detail="A scan is already running")

    from app.services.whatsapp_service import get_wa_chats

    if body.chat_ids:
        chat_ids = body.chat_ids
    else:
        chats = await get_wa_chats(profile.id)
        chat_ids = [c["id"] for c in chats]

    if not chat_ids:
        raise HTTPException(status_code=400, detail="No chats available to scan")

    t = threading.Thread(
        target=_start_scan_thread,
        args=(chat_ids, body.limit_per_chat, profile.id),
        daemon=True,
    )
    t.start()
    return {"status": "started", "total_chats": len(chat_ids)}
