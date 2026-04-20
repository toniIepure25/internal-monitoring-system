import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IncidentStatus(str, enum.Enum):
    ONGOING = "ONGOING"
    RESOLVED = "RESOLVED"


class IncidentSeverity(str, enum.Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True
    )
    host_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hosts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    incident_type: Mapped[str] = mapped_column(String(20), nullable=False, default="APPLICATION")
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(
            IncidentStatus,
            name="incident_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=IncidentStatus.ONGOING,
        nullable=False,
    )
    severity: Mapped[IncidentSeverity] = mapped_column(
        SAEnum(
            IncidentSeverity,
            name="incident_severity",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=IncidentSeverity.WARNING,
        nullable=False,
    )
    previous_state: Mapped[str] = mapped_column(String(20), nullable=False)
    new_state: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    application = relationship("Application", back_populates="incidents")
    host = relationship("Host", foreign_keys=[host_id])
    notification_logs = relationship("NotificationLog", back_populates="incident")
