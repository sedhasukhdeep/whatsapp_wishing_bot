from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContactSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class DetectedOccasionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    message_id: str
    source_chat_id: str
    source_chat_name: str | None
    raw_message: str
    detected_name: str
    occasion_type: str
    occasion_label: str | None
    detected_month: int | None
    detected_day: int | None
    detected_year: int | None
    confidence: str
    matched_contact_id: int | None
    match_score: int | None
    status: str
    created_occasion_id: int | None
    created_at: datetime
    matched_contact: ContactSummary | None = None


class DetectionConfirmRequest(BaseModel):
    contact_id: int
    occasion_type: str
    month: int
    day: int
    year: int | None = None
    label: str | None = None
