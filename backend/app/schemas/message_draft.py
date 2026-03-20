from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.contact import ContactOut
from app.schemas.occasion import OccasionOut

DraftStatus = Literal["pending", "approved", "sent", "skipped", "scheduled"]


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
    gif_url: str | None
    scheduled_for: datetime | None
    status: DraftStatus
    sent_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DraftApproveRequest(BaseModel):
    edited_text: str | None = None


class DraftSendRequest(BaseModel):
    target_id: int | None = None  # None = use contact's linked whatsapp_chat_id
    gif_url: str | None = None


class RegenerateRequest(BaseModel):
    feedback: str | None = None


class DraftScheduleRequest(BaseModel):
    scheduled_for: datetime


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


# Phase 4: History
class ContactSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    relationship: str
    relationship_label: str | None


class OccasionSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    type: str
    label: str | None


class DraftHistoryItem(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    occasion_date: date
    final_text: str | None
    sent_at: datetime | None
    gif_url: str | None
    contact: ContactSummary
    occasion: OccasionSummary

