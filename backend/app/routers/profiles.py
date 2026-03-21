from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_profile
from app.models.profile import Profile
from app.schemas.profile import ProfileCreate, ProfileOut, ProfileUpdate, VerifyPinRequest, hash_pin, verify_pin

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileOut])
def list_profiles(db: Session = Depends(get_db)):
    profiles = db.query(Profile).order_by(Profile.created_at).all()
    return [ProfileOut.from_model(p) for p in profiles]


@router.post("", response_model=ProfileOut, status_code=201)
def create_profile(body: ProfileCreate, db: Session = Depends(get_db)):
    pin_hash = hash_pin(body.pin) if body.pin else None
    profile = Profile(name=body.name, pin_hash=pin_hash)
    db.add(profile)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A profile named '{body.name}' already exists")
    db.refresh(profile)
    return ProfileOut.from_model(profile)


@router.post("/{profile_id}/verify-pin")
def verify_profile_pin(profile_id: int, body: VerifyPinRequest, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if not profile.pin_hash:
        return {"ok": True}
    if not verify_pin(body.pin, profile.pin_hash):
        raise HTTPException(status_code=403, detail="Incorrect PIN")
    return {"ok": True}


@router.put("/{profile_id}", response_model=ProfileOut)
def update_profile(
    profile_id: int,
    body: ProfileUpdate,
    current: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    if current.id != profile_id:
        raise HTTPException(status_code=403, detail="Cannot edit another profile")
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if body.name is not None:
        profile.name = body.name.strip()
    if body.pin == "":
        profile.pin_hash = None          # remove PIN
    elif body.pin is not None:
        profile.pin_hash = hash_pin(body.pin)
    if body.wa_admin_chat_id is not None:
        profile.wa_admin_chat_id = body.wa_admin_chat_id or None
    if body.wa_admin_chat_name is not None:
        profile.wa_admin_chat_name = body.wa_admin_chat_name or None
    if body.notifications_enabled is not None:
        profile.notifications_enabled = body.notifications_enabled

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A profile named '{body.name}' already exists")
    db.refresh(profile)
    return ProfileOut.from_model(profile)


@router.delete("/{profile_id}", status_code=204)
def delete_profile(
    profile_id: int,
    current: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
):
    if current.id != profile_id:
        raise HTTPException(status_code=403, detail="Cannot delete another profile")
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    total = db.query(Profile).count()
    if total <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last profile")
    db.delete(profile)
    db.commit()
