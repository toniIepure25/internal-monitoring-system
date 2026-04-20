import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HealthCandidate(Base):
    __tablename__ = "health_candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_json: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_health_indicators: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    probed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    application = relationship("Application", back_populates="health_candidates")
