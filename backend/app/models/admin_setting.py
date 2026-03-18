from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AdminSetting(Base):
    __tablename__ = "admin_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
