from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WhatsAppTarget(Base):
    __tablename__ = "whatsapp_targets"
    __table_args__ = (UniqueConstraint("profile_id", "name", name="uq_targets_profile_name"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, default=1)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    chat_id: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(10), nullable=False)  # group / individual
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    drafts: Mapped[list["MessageDraft"]] = relationship(  # noqa: F821
        "MessageDraft", back_populates="whatsapp_target"
    )
