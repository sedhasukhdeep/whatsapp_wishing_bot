from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MessageDraft(Base):
    __tablename__ = "message_drafts"
    __table_args__ = (UniqueConstraint("occasion_id", "occasion_date", name="uq_draft_occasion_date"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    occasion_id: Mapped[int] = mapped_column(ForeignKey("occasions.id"), nullable=False)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id"), nullable=False)
    whatsapp_target_id: Mapped[int | None] = mapped_column(
        ForeignKey("whatsapp_targets.id"), nullable=True
    )
    occasion_date: Mapped[date] = mapped_column(Date, nullable=False)
    generated_text: Mapped[str] = mapped_column(Text, nullable=False)
    edited_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    gif_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    generation_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now(), onupdate=func.now()
    )

    occasion: Mapped["Occasion"] = relationship("Occasion", back_populates="drafts")  # noqa: F821
    contact: Mapped["Contact"] = relationship("Contact", back_populates="drafts")  # noqa: F821
    whatsapp_target: Mapped["WhatsAppTarget | None"] = relationship(  # noqa: F821
        "WhatsAppTarget", back_populates="drafts"
    )
