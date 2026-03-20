from datetime import datetime

from pydantic import BaseModel


class BroadcastCreate(BaseModel):
    name: str
    occasion_name: str


class BroadcastOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    occasion_name: str
    message_text: str | None
    status: str
    created_at: datetime
    sent_at: datetime | None


class BroadcastRecipientOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    broadcast_id: int
    recipient_type: str | None
    contact_id: int | None
    target_id: int | None
    contact_name: str | None = None
    contact_display_name: str | None = None  # alias if use_alias_in_broadcast, else first name
    target_name: str | None = None
    sent_at: datetime | None
    error: str | None

    @classmethod
    def from_orm_with_names(cls, r: object) -> "BroadcastRecipientOut":
        from app.models.broadcast_recipient import BroadcastRecipient
        assert isinstance(r, BroadcastRecipient)
        display_name = None
        if r.contact:
            if r.contact.use_alias_in_broadcast and r.contact.alias:
                display_name = r.contact.alias
            else:
                display_name = (r.contact.name or "").split()[0]
        return cls(
            id=r.id,
            broadcast_id=r.broadcast_id,
            recipient_type=r.recipient_type,
            contact_id=r.contact_id,
            target_id=r.target_id,
            contact_name=r.contact.name if r.contact else None,
            contact_display_name=display_name,
            target_name=r.target.name if r.target else None,
            sent_at=r.sent_at,
            error=r.error,
        )


class BroadcastWithRecipients(BroadcastOut):
    recipients: list[BroadcastRecipientOut] = []


class AddRecipientsRequest(BaseModel):
    contact_ids: list[int] = []
    target_ids: list[int] = []
