import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DetectionSource(str, enum.Enum):
    AUTO = "auto"
    MANUAL = "manual"


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    normalized_url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False, index=True)
    health_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    detection_source: Mapped[DetectionSource] = mapped_column(
        SAEnum(
            DetectionSource,
            name="detection_source",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=DetectionSource.AUTO,
        nullable=False,
    )
    environment: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_maintenance: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    monitoring_interval_seconds: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    consecutive_failures_threshold: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    consecutive_recovery_threshold: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    slow_threshold_ms: Mapped[int] = mapped_column(Integer, default=2000, nullable=False)

    frontend_container: Mapped[str | None] = mapped_column(String(200), nullable=True)
    backend_container: Mapped[str | None] = mapped_column(String(200), nullable=True)
    github_repo: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    creator = relationship("User", back_populates="applications")
    health_candidates = relationship("HealthCandidate", back_populates="application", cascade="all, delete-orphan")
    status = relationship("ApplicationStatus", back_populates="application", uselist=False, cascade="all, delete-orphan")
    health_checks = relationship("HealthCheck", back_populates="application", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="application", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="application", cascade="all, delete-orphan")
