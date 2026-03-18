"""Add gif_url, relationship_label, broadcasts, broadcast_recipients

Revision ID: 003
Revises: 002
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # contacts: add relationship_label
    op.add_column("contacts", sa.Column("relationship_label", sa.String(100), nullable=True))

    # message_drafts: add gif_url
    op.add_column("message_drafts", sa.Column("gif_url", sa.String(500), nullable=True))

    # broadcasts table
    op.create_table(
        "broadcasts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("occasion_name", sa.String(200), nullable=False),
        sa.Column("message_text", sa.Text, nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("sent_at", sa.DateTime, nullable=True),
    )

    # broadcast_recipients table
    op.create_table(
        "broadcast_recipients",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("broadcast_id", sa.Integer, sa.ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_type", sa.String(10), nullable=True),
        sa.Column("contact_id", sa.Integer, sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target_id", sa.Integer, sa.ForeignKey("whatsapp_targets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sent_at", sa.DateTime, nullable=True),
        sa.Column("error", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("broadcast_recipients")
    op.drop_table("broadcasts")
    op.drop_column("message_drafts", "gif_url")
    op.drop_column("contacts", "relationship_label")
