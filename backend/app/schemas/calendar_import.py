from typing import Literal

from pydantic import BaseModel

from app.schemas.contact import RelationshipType

OccasionTypeStr = Literal["birthday", "anniversary", "custom"]


class CalendarImportPreviewItem(BaseModel):
    raw_summary: str
    name: str
    occasion_type: OccasionTypeStr
    label: str | None
    month: int
    day: int
    year: int | None
    existing_contact_id: int | None = None
    existing_contact_name: str | None = None


class CalendarImportConfirmItem(BaseModel):
    name: str
    occasion_type: OccasionTypeStr
    label: str | None = None
    month: int
    day: int
    year: int | None = None
    phone: str
    relationship: RelationshipType = "friend"
    existing_contact_id: int | None = None  # if set, add occasion to existing contact


class CalendarImportConfirmRequest(BaseModel):
    items: list[CalendarImportConfirmItem]


class CalendarImportResult(BaseModel):
    contacts_created: int
    occasions_created: int
