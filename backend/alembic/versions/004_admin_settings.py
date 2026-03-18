"""Add admin_settings table for AI configuration

Revision ID: 004
Revises: 003
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("admin_settings")
