from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as sa_relationship

from app.database import Base


class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("profile_id", "phone", name="uq_contacts_profile_phone"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, default=1)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    relationship: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone_preference: Mapped[str] = mapped_column(String(20), nullable=False, default="warm")
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    message_length: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    alias: Mapped[str | None] = mapped_column(String(100), nullable=True)
    use_alias_in_broadcast: Mapped[bool] = mapped_column(nullable=False, default=False)
    use_alias: Mapped[bool] = mapped_column(nullable=False, default=False)
    auto_send: Mapped[bool] = mapped_column(nullable=False, default=False)
    relationship_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    partner_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    whatsapp_chat_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    whatsapp_chat_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now(), onupdate=func.now()
    )

    occasions: Mapped[list["Occasion"]] = sa_relationship(  # noqa: F821
        "Occasion", back_populates="contact", cascade="all, delete-orphan"
    )
    drafts: Mapped[list["MessageDraft"]] = sa_relationship(  # noqa: F821
        "MessageDraft", back_populates="contact", cascade="all, delete-orphan"
    )
