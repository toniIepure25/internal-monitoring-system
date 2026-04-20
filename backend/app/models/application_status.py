import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AppState(str, enum.Enum):
    UP = "UP"
    DOWN = "DOWN"
    DEGRADED = "DEGRADED"
    SLOW = "SLOW"
    UNKNOWN = "UNKNOWN"


class ApplicationStatus(Base):
    __tablename__ = "application_status"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[AppState] = mapped_column(
        SAEnum(AppState, name="app_state", values_callable=lambda enum_cls: [member.value for member in enum_cls]),
        default=AppState.UNKNOWN,
        nullable=False,
    )
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consecutive_successes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    application = relationship("Application", back_populates="status")
