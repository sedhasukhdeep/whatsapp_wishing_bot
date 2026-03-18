from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

TargetType = Literal["group", "individual"]


class WhatsAppTargetBase(BaseModel):
    name: str
    chat_id: str
    target_type: TargetType
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 200:
            raise ValueError("Name must be 200 characters or less")
        return v

    @field_validator("chat_id")
    @classmethod
    def validate_chat_id(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("chat_id cannot be empty")
        if len(v) > 50:
            raise ValueError("chat_id must be 50 characters or less")
        return v


class WhatsAppTargetCreate(WhatsAppTargetBase):
    pass


class WhatsAppTargetUpdate(WhatsAppTargetBase):
    pass


class WhatsAppTargetOut(WhatsAppTargetBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime


class BridgeStatus(BaseModel):
    ready: bool
    qr_image: str | None = None
