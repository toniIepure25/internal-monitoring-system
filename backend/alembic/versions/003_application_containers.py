"""Add container name columns to applications

Revision ID: 003
Revises: 002
Create Date: 2026-04-21
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("frontend_container", sa.String(200), nullable=True))
    op.add_column("applications", sa.Column("backend_container", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "backend_container")
    op.drop_column("applications", "frontend_container")
