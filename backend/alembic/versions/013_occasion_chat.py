"""Add occasion_chat_id and occasion_chat_name to contacts

Revision ID: 013
Revises: 012
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("contacts", sa.Column("occasion_chat_id", sa.String(100), nullable=True))
    op.add_column("contacts", sa.Column("occasion_chat_name", sa.String(100), nullable=True))


def downgrade():
    op.drop_column("contacts", "occasion_chat_id")
    op.drop_column("contacts", "occasion_chat_name")
