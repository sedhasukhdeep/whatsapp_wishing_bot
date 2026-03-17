from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.occasion import OccasionOut

RelationshipType = Literal["family", "friend", "colleague", "acquaintance", "other"]
ToneType = Literal["warm", "funny", "formal"]
LengthType = Literal["short", "medium", "long"]


class ContactBase(BaseModel):
    name: str
    phone: str
    relationship: RelationshipType
    notes: str | None = None
    tone_preference: ToneType = "warm"
    language: str = "en"
    message_length: LengthType = "medium"
    custom_instructions: str | None = None
    whatsapp_chat_id: str | None = None
    whatsapp_chat_name: str | None = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(ContactBase):
    pass


class ContactOut(ContactBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime


class ContactWithOccasions(ContactOut):
    occasions: list[OccasionOut] = []
