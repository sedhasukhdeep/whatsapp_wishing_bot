from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_profile
from app.models import WhatsAppTarget
from app.models.profile import Profile
from app.schemas.whatsapp_target import (
    BridgeStatus,
    WhatsAppTargetCreate,
    WhatsAppTargetOut,
    WhatsAppTargetUpdate,
)
from app.services.whatsapp_service import get_bridge_status, get_wa_chats, init_bridge_session, restart_bridge_session, restart_bridge

router = APIRouter(prefix="/api/targets", tags=["whatsapp_targets"])


@router.get("", response_model=list[WhatsAppTargetOut])
def list_targets(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    return db.query(WhatsAppTarget).filter(WhatsAppTarget.profile_id == profile.id).order_by(WhatsAppTarget.name).all()


@router.post("", response_model=WhatsAppTargetOut, status_code=201)
def create_target(
    body: WhatsAppTargetCreate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    target = WhatsAppTarget(**body.model_dump(), profile_id=profile.id)
    db.add(target)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A target with that name already exists in this profile")
    db.refresh(target)
    return target


@router.put("/{target_id}", response_model=WhatsAppTargetOut)
def update_target(
    target_id: int,
    body: WhatsAppTargetUpdate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    target = db.query(WhatsAppTarget).filter(
        WhatsAppTarget.id == target_id, WhatsAppTarget.profile_id == profile.id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    for field, value in body.model_dump().items():
        setattr(target, field, value)
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{target_id}", status_code=204)
def delete_target(
    target_id: int,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    target = db.query(WhatsAppTarget).filter(
        WhatsAppTarget.id == target_id, WhatsAppTarget.profile_id == profile.id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    db.delete(target)
    db.commit()


@router.get("/bridge-status", response_model=BridgeStatus)
async def bridge_status(profile: Profile = Depends(get_current_profile)):
    return await get_bridge_status(profile.id)


@router.post("/init-session", response_model=BridgeStatus)
async def init_session(profile: Profile = Depends(get_current_profile)):
    """Tell the bridge to start (or re-init) the WhatsApp session for this profile."""
    return await init_bridge_session(profile.id)


@router.get("/chats")
async def list_wa_chats(profile: Profile = Depends(get_current_profile)):
    """Return all WhatsApp chats for this profile's session."""
    return await get_wa_chats(profile.id)


@router.post("/restart-session", response_model=BridgeStatus)
async def restart_session(profile: Profile = Depends(get_current_profile)):
    """Force-destroy and reinitialize the WhatsApp session (for recovery from stuck 'starting' state)."""
    return await restart_bridge_session(profile.id)


@router.post("/restart-bridge")
async def restart_bridge_endpoint(_profile: Profile = Depends(get_current_profile)):
    """Restart the WhatsApp bridge process (Docker will auto-restart it)."""
    return await restart_bridge()
