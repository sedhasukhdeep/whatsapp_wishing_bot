from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from app.schemas.occasion import OccasionOut

RelationshipType = Literal["family", "friend", "colleague", "acquaintance", "other"]
ToneType = Literal["warm", "funny", "formal"]
LengthType = Literal["short", "medium", "long"]


class ContactBase(BaseModel):
    name: str
    phone: str
    relationship: RelationshipType
    relationship_label: str | None = None
    alias: str | None = None
    use_alias_in_broadcast: bool = False
    use_alias: bool = False
    auto_send: bool = False
    notes: str | None = None
    tone_preference: ToneType = "warm"
    language: str = "en"
    message_length: LengthType = "medium"
    custom_instructions: str | None = None
    partner_name: str | None = None
    whatsapp_chat_id: str | None = None
    whatsapp_chat_name: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 200:
            raise ValueError("Name must be 200 characters or less")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("+"):
            raise ValueError("Phone must be in international format starting with + (e.g. +919876543210)")
        digits = v[1:].replace(" ", "").replace("-", "")
        if not digits.isdigit():
            raise ValueError("Phone number must contain only digits after the + sign")
        if not (7 <= len(digits) <= 15):
            raise ValueError("Phone number must be between 7 and 15 digits")
        return v


class ContactCreate(ContactBase):
    pass


class ContactUpdate(ContactBase):
    pass


class ContactOut(ContactBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
    updated_at: datetime
    occasions_count: int = 0


class ContactWithOccasions(ContactOut):
    occasions: list[OccasionOut] = []


class WaSyncPreviewItem(BaseModel):
    phone: str
    name: str
    chat_id: str
    already_exists: bool
    existing_contact_id: int | None = None


class WaSyncImportItem(BaseModel):
    phone: str
    name: str
    chat_id: str
    relationship: RelationshipType


class WaSyncImportRequest(BaseModel):
    items: list[WaSyncImportItem]


class WaSyncImportResult(BaseModel):
    created: int
    skipped: int


class GroupTagPreviewItem(BaseModel):
    contact_id: int
    name: str
    phone: str
    current_relationship: RelationshipType


class BulkTagRequest(BaseModel):
    contact_ids: list[int]
    relationship: RelationshipType


class BulkTagResult(BaseModel):
    updated: int
