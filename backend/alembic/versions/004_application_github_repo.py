"""Add github_repo column to applications

Revision ID: 004
Revises: 003
Create Date: 2026-04-21
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("github_repo", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "github_repo")
