from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as sa_relationship

from app.database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    relationship: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone_preference: Mapped[str] = mapped_column(String(20), nullable=False, default="warm")
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")
    message_length: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
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
        "MessageDraft", back_populates="contact"
    )
