from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.contact import ContactOut
from app.schemas.occasion import OccasionOut
from app.schemas.whatsapp_target import WhatsAppTargetOut

DraftStatus = Literal["pending", "approved", "sent", "skipped"]


class MessageDraftOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    occasion_id: int
    contact_id: int
    whatsapp_target_id: int | None
    occasion_date: date
    generated_text: str
    edited_text: str | None
    final_text: str | None
    status: DraftStatus
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DraftApproveRequest(BaseModel):
    edited_text: str | None = None


class DraftSendRequest(BaseModel):
    target_id: int | None = None  # None = use contact's linked whatsapp_chat_id


# Dashboard composite response
class DashboardOccasionItem(BaseModel):
    occasion: OccasionOut
    contact: ContactOut
    draft: MessageDraftOut | None
    turning_age: int | None = None
    years_together: int | None = None


class DashboardUpcomingItem(BaseModel):
    occasion: OccasionOut
    contact: ContactOut
    days_away: int
    turning_age: int | None = None
    years_together: int | None = None
