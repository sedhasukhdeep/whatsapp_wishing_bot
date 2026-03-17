from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator

OccasionType = Literal["birthday", "anniversary", "custom"]

# Max valid days per month (Feb allows 29 for leap-year birthdays)
_MAX_DAYS = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


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
    def validate_occasion(self) -> "OccasionBase":
        if self.type == "custom" and not self.label:
            raise ValueError("label is required when type is 'custom'")

        if not (1 <= self.month <= 12):
            raise ValueError("month must be between 1 and 12")

        max_day = _MAX_DAYS[self.month]
        if not (1 <= self.day <= max_day):
            raise ValueError(
                f"day {self.day} is not valid for month {self.month} "
                f"(max {max_day} days)"
            )

        if self.year is not None and not (1900 <= self.year <= 2100):
            raise ValueError("year must be between 1900 and 2100")

        return self


class OccasionCreate(OccasionBase):
    pass


class OccasionUpdate(OccasionBase):
    pass


class OccasionOut(OccasionBase):
    model_config = {"from_attributes": True}

    id: int
    created_at: datetime
