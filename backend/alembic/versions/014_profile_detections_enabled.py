"""Add detections_enabled to profiles

Revision ID: 014
Revises: 013
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "profiles",
        sa.Column("detections_enabled", sa.Boolean(), nullable=False, server_default="1"),
    )


def downgrade():
    op.drop_column("profiles", "detections_enabled")
