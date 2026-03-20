from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DetectedOccasion(Base):
    __tablename__ = "detected_occasions"
    __table_args__ = (Index("ix_detected_occasions_status_created", "status", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    source_chat_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source_chat_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    raw_message: Mapped[str] = mapped_column(Text, nullable=False)
    detected_name: Mapped[str] = mapped_column(String(255), nullable=False)
    occasion_type: Mapped[str] = mapped_column(String(50), nullable=False)
    occasion_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    detected_month: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    detected_day: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    detected_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    confidence: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    matched_contact_id: Mapped[int | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    match_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sender_jid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sender_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_occasion_id: Mapped[int | None] = mapped_column(
        ForeignKey("occasions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    matched_contact: Mapped["Contact | None"] = relationship(  # noqa: F821
        "Contact", foreign_keys=[matched_contact_id]
    )
