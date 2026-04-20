"""Host monitoring tables and incident extensions

Revision ID: 002
Revises: 001
Create Date: 2026-04-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM as PG_ENUM

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum once; sa.Enum(..., create_type=False) still triggers a second CREATE TYPE
    # when used in create_table unless the type already exists — use idempotent DDL.
    op.execute(
        text(
            "DO $$ BEGIN CREATE TYPE host_state AS ENUM "
            "('ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN'); "
            "EXCEPTION WHEN duplicate_object THEN null; END $$;"
        )
    )
    # Use PostgreSQL ENUM with create_type=False so SQLAlchemy does not emit a second CREATE TYPE
    host_state_col = PG_ENUM(
        "ONLINE", "OFFLINE", "DEGRADED", "UNKNOWN",
        name="host_state",
        create_type=False,
    )

    op.create_table(
        "hosts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hostname", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("api_key", sa.String(128), unique=True, nullable=False),
        sa.Column("environment", sa.String(50), nullable=True),
        sa.Column("tags", JSONB, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("os_info", sa.String(200), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("heartbeat_interval_seconds", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("heartbeat_timeout_seconds", sa.Integer(), nullable=False, server_default=sa.text("90")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "host_status",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("host_id", UUID(as_uuid=True), sa.ForeignKey("hosts.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("status", host_state_col, nullable=False, server_default="UNKNOWN"),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consecutive_misses", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("consecutive_heartbeats", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("os_version", sa.String(100), nullable=True),
        sa.Column("uptime_seconds", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "host_heartbeats",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("host_id", UUID(as_uuid=True), sa.ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("os_version", sa.String(100), nullable=True),
        sa.Column("uptime_seconds", sa.Integer(), nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
    )

    op.create_table(
        "application_hosts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("application_id", UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("host_id", UUID(as_uuid=True), sa.ForeignKey("hosts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("application_id", "host_id", name="uq_application_host"),
    )

    op.add_column("incidents", sa.Column("host_id", UUID(as_uuid=True), sa.ForeignKey("hosts.id", ondelete="CASCADE"), nullable=True, index=True))
    op.add_column("incidents", sa.Column("incident_type", sa.String(20), nullable=False, server_default="APPLICATION"))

    # Make application_id nullable (host-only incidents have no application)
    op.alter_column("incidents", "application_id", nullable=True)


def downgrade() -> None:
    op.alter_column("incidents", "application_id", nullable=False)
    op.drop_column("incidents", "incident_type")
    op.drop_column("incidents", "host_id")
    op.drop_table("application_hosts")
    op.drop_table("host_heartbeats")
    op.drop_table("host_status")
    op.drop_table("hosts")
    sa.Enum(name="host_state").drop(op.get_bind(), checkfirst=True)
