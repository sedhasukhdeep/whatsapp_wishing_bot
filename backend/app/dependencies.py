from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.profile import Profile


def get_current_profile(
    x_profile_id: int = Header(alias="X-Profile-ID"),
    db: Session = Depends(get_db),
) -> Profile:
    profile = db.query(Profile).filter(Profile.id == x_profile_id).first()
    if not profile:
        raise HTTPException(status_code=401, detail="Invalid or missing profile")
    return profile
