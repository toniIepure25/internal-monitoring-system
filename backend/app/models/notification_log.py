import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.notification_channel import ChannelType


class DeliveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class NotificationLog(Base):
    __tablename__ = "notification_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True
    )
    incident_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True
    )
    channel_type: Mapped[ChannelType] = mapped_column(
        SAEnum(
            ChannelType,
            name="channel_type",
            create_type=False,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    status: Mapped[DeliveryStatus] = mapped_column(
        SAEnum(
            DeliveryStatus,
            name="delivery_status",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=DeliveryStatus.PENDING,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    incident = relationship("Incident", back_populates="notification_logs")
