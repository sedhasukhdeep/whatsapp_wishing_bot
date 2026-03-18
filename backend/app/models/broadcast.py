from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Broadcast(Base):
    __tablename__ = "broadcasts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    occasion_name: Mapped[str] = mapped_column(String(200), nullable=False)
    message_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    recipients: Mapped[list["BroadcastRecipient"]] = relationship(  # noqa: F821
        "BroadcastRecipient", back_populates="broadcast", cascade="all, delete-orphan"
    )
