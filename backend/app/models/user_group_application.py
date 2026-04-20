import uuid
from datetime import datetime, timezone

from sqlalchemy import Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserGroupApplication(Base):
    __tablename__ = "user_group_applications"
    __table_args__ = (UniqueConstraint("group_id", "application_id", name="uq_group_application"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    group = relationship("UserGroup", back_populates="group_applications")
    application = relationship("Application")
