"""Add whatsapp chat to contacts and tone overrides to occasions

Revision ID: 002
Revises: 001
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contacts", sa.Column("whatsapp_chat_id", sa.String(100), nullable=True))
    op.add_column("contacts", sa.Column("whatsapp_chat_name", sa.String(100), nullable=True))

    op.add_column("occasions", sa.Column("tone_override", sa.String(20), nullable=True))
    op.add_column("occasions", sa.Column("language_override", sa.String(10), nullable=True))
    op.add_column("occasions", sa.Column("length_override", sa.String(10), nullable=True))
    op.add_column("occasions", sa.Column("custom_instructions_override", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("contacts", "whatsapp_chat_id")
    op.drop_column("contacts", "whatsapp_chat_name")

    op.drop_column("occasions", "tone_override")
    op.drop_column("occasions", "language_override")
    op.drop_column("occasions", "length_override")
    op.drop_column("occasions", "custom_instructions_override")
