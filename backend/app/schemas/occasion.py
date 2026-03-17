from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

OccasionType = Literal["birthday", "anniversary", "custom"]


class OccasionBase(BaseModel):
    contact_id: int
    type: OccasionType
    label: str | None = None
    month: int
    day: int
    year: int | None = None
    active: bool = True
    tone_override: str | None = None
    language_override: str | None = None
    length_override: str | None = None
    custom_instructions_override: str | None = None

    @model_validator(mode="after")
    def label_required_for_custom(self) -> "OccasionBase":
        if self.type == "custom" and not self.label:
            raise ValueError("label is required when type is 'custom'")
        return self


class OccasionCreate(OccasionBase):
    pass


class OccasionUpdate(OccasionBase):
    pass


class OccasionOut(OccasionBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
