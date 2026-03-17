"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(50), unique=True, nullable=False),
        sa.Column("relationship", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("tone_preference", sa.String(20), nullable=False, server_default="warm"),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("message_length", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("custom_instructions", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "occasions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("contact_id", sa.Integer, sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("month", sa.SmallInteger, nullable=False),
        sa.Column("day", sa.SmallInteger, nullable=False),
        sa.Column("year", sa.SmallInteger, nullable=True),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_occasions_month_day", "occasions", ["month", "day"])

    op.create_table(
        "whatsapp_targets",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("chat_id", sa.String(100), unique=True, nullable=False),
        sa.Column("target_type", sa.String(10), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "message_drafts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("occasion_id", sa.Integer, sa.ForeignKey("occasions.id"), nullable=False),
        sa.Column("contact_id", sa.Integer, sa.ForeignKey("contacts.id"), nullable=False),
        sa.Column("whatsapp_target_id", sa.Integer, sa.ForeignKey("whatsapp_targets.id"), nullable=True),
        sa.Column("occasion_date", sa.Date, nullable=False),
        sa.Column("generated_text", sa.Text, nullable=False),
        sa.Column("edited_text", sa.Text, nullable=True),
        sa.Column("final_text", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("generation_prompt", sa.Text, nullable=True),
        sa.Column("sent_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("occasion_id", "occasion_date", name="uq_draft_occasion_date"),
    )


def downgrade() -> None:
    op.drop_table("message_drafts")
    op.drop_table("whatsapp_targets")
    op.drop_index("ix_occasions_month_day", table_name="occasions")
    op.drop_table("occasions")
    op.drop_table("contacts")
