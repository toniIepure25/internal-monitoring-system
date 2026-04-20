import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HostHeartbeat(Base):
    __tablename__ = "host_heartbeats"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    os_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uptime_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)

    host = relationship("Host", back_populates="heartbeats")
