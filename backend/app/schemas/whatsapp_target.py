from datetime import datetime
from typing import Literal

from pydantic import BaseModel

TargetType = Literal["group", "individual"]


class WhatsAppTargetBase(BaseModel):
    name: str
    chat_id: str
    target_type: TargetType
    description: str | None = None


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
