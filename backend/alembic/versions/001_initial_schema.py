"""Initial schema with all tables

Revision ID: 001
Revises:
Create Date: 2026-04-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM as PG_ENUM

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = PG_ENUM("admin", "user", name="user_role", create_type=False)
    detection_source = PG_ENUM("auto", "manual", name="detection_source", create_type=False)
    app_state = PG_ENUM("UP", "DOWN", "DEGRADED", "SLOW", "UNKNOWN", name="app_state", create_type=False)
    incident_status = PG_ENUM("ONGOING", "RESOLVED", name="incident_status", create_type=False)
    incident_severity = PG_ENUM("CRITICAL", "WARNING", "INFO", name="incident_severity", create_type=False)
    channel_type = PG_ENUM("email", "browser_push", "telegram", name="channel_type", create_type=False)
    delivery_status = PG_ENUM("PENDING", "SENT", "FAILED", name="delivery_status", create_type=False)

    for e in [user_role, detection_source, app_state, incident_status, incident_severity, channel_type, delivery_status]:
        e.create(op.get_bind(), checkfirst=True)

    # Users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(320), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(128), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Applications
    op.create_table(
        "applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("base_url", sa.String(2048), nullable=False),
        sa.Column("normalized_url", sa.String(2048), unique=True, nullable=False, index=True),
        sa.Column("health_url", sa.String(2048), nullable=True),
        sa.Column("detection_source", detection_source, nullable=False, server_default="auto"),
        sa.Column("environment", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_maintenance", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("monitoring_interval_seconds", sa.Integer(), nullable=False, server_default=sa.text("60")),
        sa.Column("timeout_seconds", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("consecutive_failures_threshold", sa.Integer(), nullable=False, server_default=sa.text("3")),
        sa.Column("consecutive_recovery_threshold", sa.Integer(), nullable=False, server_default=sa.text("2")),
        sa.Column("slow_threshold_ms", sa.Integer(), nullable=False, server_default=sa.text("2000")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Health candidates
    op.create_table(
        "health_candidates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("application_id", UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("is_json", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("has_health_indicators", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("score", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_selected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("probed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Application status
    op.create_table(
        "application_status",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("application_id", UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("status", app_state, nullable=False, server_default="UNKNOWN"),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_response_time_ms", sa.Integer(), nullable=True),
        sa.Column("last_http_status", sa.Integer(), nullable=True),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("consecutive_successes", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Health checks log
    op.create_table(
        "health_checks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("application_id", UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", app_state, nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(1000), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Incidents
    op.create_table(
        "incidents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("application_id", UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("status", incident_status, nullable=False, server_default="ONGOING"),
        sa.Column("severity", incident_severity, nullable=False, server_default="WARNING"),
        sa.Column("previous_state", sa.String(20), nullable=False),
        sa.Column("new_state", sa.String(20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Subscriptions
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("application_id", UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("notify_on_down", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notify_on_up", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notify_on_degraded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("notify_on_slow", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "application_id", name="uq_user_application"),
    )

    # Notification channels
    op.create_table(
        "notification_channels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("channel_type", channel_type, nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("config", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # User groups
    op.create_table(
        "user_groups",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # User group applications
    op.create_table(
        "user_group_applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("user_groups.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("application_id", UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("group_id", "application_id", name="uq_group_application"),
    )

    # Notification log
    op.create_table(
        "notification_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("subscription_id", UUID(as_uuid=True), sa.ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("incident_id", UUID(as_uuid=True), sa.ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("channel_type", channel_type, nullable=False),
        sa.Column("status", delivery_status, nullable=False, server_default="PENDING"),
        sa.Column("error_message", sa.String(1000), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("notification_log")
    op.drop_table("user_group_applications")
    op.drop_table("user_groups")
    op.drop_table("notification_channels")
    op.drop_table("subscriptions")
    op.drop_table("incidents")
    op.drop_table("health_checks")
    op.drop_table("application_status")
    op.drop_table("health_candidates")
    op.drop_table("applications")
    op.drop_table("users")

    sa.Enum(name="delivery_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="channel_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="incident_severity").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="incident_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="app_state").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="detection_source").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
