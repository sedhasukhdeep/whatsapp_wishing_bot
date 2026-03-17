from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WhatsAppTarget(Base):
    __tablename__ = "whatsapp_targets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    chat_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    target_type: Mapped[str] = mapped_column(String(10), nullable=False)  # group / individual
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())

    drafts: Mapped[list["MessageDraft"]] = relationship(  # noqa: F821
        "MessageDraft", back_populates="whatsapp_target"
    )
