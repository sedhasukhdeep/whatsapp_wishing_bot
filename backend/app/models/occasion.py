from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Occasion(Base):
    __tablename__ = "occasions"
    __table_args__ = (Index("ix_occasions_month_day", "month", "day"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # birthday / anniversary / custom
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    day: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tone_override: Mapped[str | None] = mapped_column(String(20), nullable=True)
    language_override: Mapped[str | None] = mapped_column(String(10), nullable=True)
    length_override: Mapped[str | None] = mapped_column(String(10), nullable=True)
    custom_instructions_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    contact: Mapped["Contact"] = relationship("Contact", back_populates="occasions")  # noqa: F821
    drafts: Mapped[list["MessageDraft"]] = relationship(  # noqa: F821
        "MessageDraft", back_populates="occasion", cascade="all, delete-orphan"
    )
