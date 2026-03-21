import hashlib
import secrets
from datetime import datetime

from pydantic import BaseModel, field_validator


def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}:{pin}".encode()).hexdigest()
    return f"{salt}:{h}"


def verify_pin(pin: str, pin_hash: str) -> bool:
    try:
        salt, h = pin_hash.split(":", 1)
        return hashlib.sha256(f"{salt}:{pin}".encode()).hexdigest() == h
    except Exception:
        return False


class ProfileCreate(BaseModel):
    name: str
    pin: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or less")
        return v

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if v and not v.isdigit():
            raise ValueError("PIN must be digits only")
        if v and not (4 <= len(v) <= 8):
            raise ValueError("PIN must be 4–8 digits")
        return v or None


class ProfileUpdate(BaseModel):
    name: str | None = None
    pin: str | None = None          # None = don't change; "" = remove PIN
    wa_admin_chat_id: str | None = None
    wa_admin_chat_name: str | None = None
    notifications_enabled: bool | None = None


class ProfileOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    has_pin: bool = False
    wa_admin_chat_id: str | None
    wa_admin_chat_name: str | None
    notifications_enabled: bool
    created_at: datetime

    @classmethod
    def from_model(cls, p: object) -> "ProfileOut":
        return cls(
            id=p.id,  # type: ignore[attr-defined]
            name=p.name,  # type: ignore[attr-defined]
            has_pin=p.pin_hash is not None,  # type: ignore[attr-defined]
            wa_admin_chat_id=p.wa_admin_chat_id,  # type: ignore[attr-defined]
            wa_admin_chat_name=p.wa_admin_chat_name,  # type: ignore[attr-defined]
            notifications_enabled=p.notifications_enabled,  # type: ignore[attr-defined]
            created_at=p.created_at,  # type: ignore[attr-defined]
        )


class VerifyPinRequest(BaseModel):
    pin: str
