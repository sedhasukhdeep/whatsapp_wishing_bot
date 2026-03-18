import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import WhatsAppTarget
from app.schemas.whatsapp_target import (
    BridgeStatus,
    WhatsAppTargetCreate,
    WhatsAppTargetOut,
    WhatsAppTargetUpdate,
)

router = APIRouter(prefix="/api/targets", tags=["whatsapp_targets"])


@router.get("", response_model=list[WhatsAppTargetOut])
def list_targets(db: Session = Depends(get_db)):
    return db.query(WhatsAppTarget).order_by(WhatsAppTarget.name).all()


@router.post("", response_model=WhatsAppTargetOut, status_code=201)
def create_target(body: WhatsAppTargetCreate, db: Session = Depends(get_db)):
    target = WhatsAppTarget(**body.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


@router.put("/{target_id}", response_model=WhatsAppTargetOut)
def update_target(target_id: int, body: WhatsAppTargetUpdate, db: Session = Depends(get_db)):
    target = db.query(WhatsAppTarget).filter(WhatsAppTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    for field, value in body.model_dump().items():
        setattr(target, field, value)
    db.commit()
    db.refresh(target)
    return target


@router.delete("/{target_id}", status_code=204)
def delete_target(target_id: int, db: Session = Depends(get_db)):
    target = db.query(WhatsAppTarget).filter(WhatsAppTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    db.delete(target)
    db.commit()


@router.get("/bridge-status", response_model=BridgeStatus)
async def bridge_status():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.wa_bridge_url}/status")
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        return BridgeStatus(ready=False, qr_image=None, state='error')


@router.get("/chats")
async def list_wa_chats():
    """Return all WhatsApp chats from the connected session for target picker."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{settings.wa_bridge_url}/chats")
            if resp.status_code == 503:
                raise HTTPException(status_code=503, detail="WhatsApp not connected")
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Bridge error: {e}") from e
