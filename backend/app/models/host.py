import uuid
import secrets
from datetime import datetime, timezone
import enum

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HostState(str, enum.Enum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    DEGRADED = "DEGRADED"
    UNKNOWN = "UNKNOWN"


def generate_api_key() -> str:
    return secrets.token_hex(32)


class Host(Base):
    __tablename__ = "hosts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hostname: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    api_key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, default=generate_api_key)
    environment: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    os_info: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    heartbeat_interval_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    heartbeat_timeout_seconds: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    creator = relationship("User")
    status = relationship("HostStatus", uselist=False, back_populates="host", cascade="all, delete-orphan")
    heartbeats = relationship("HostHeartbeat", back_populates="host", cascade="all, delete-orphan")
    application_hosts = relationship("ApplicationHost", back_populates="host", cascade="all, delete-orphan")
