import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.host import HostState


class HostStatus(Base):
    __tablename__ = "host_status"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[HostState] = mapped_column(
        SAEnum(
            HostState,
            name="host_state",
            create_type=False,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=HostState.UNKNOWN,
        nullable=False,
    )
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consecutive_misses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consecutive_heartbeats: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    os_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uptime_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    host = relationship("Host", back_populates="status")
