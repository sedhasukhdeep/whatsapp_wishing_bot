from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BroadcastRecipient(Base):
    __tablename__ = "broadcast_recipients"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    broadcast_id: Mapped[int] = mapped_column(
        ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=False
    )
    recipient_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    contact_id: Mapped[int | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    target_id: Mapped[int | None] = mapped_column(
        ForeignKey("whatsapp_targets.id", ondelete="SET NULL"), nullable=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)

    broadcast: Mapped["Broadcast"] = relationship("Broadcast", back_populates="recipients")  # noqa: F821
    contact: Mapped["Contact | None"] = relationship("Contact")  # noqa: F821
    target: Mapped["WhatsAppTarget | None"] = relationship("WhatsAppTarget")  # noqa: F821
