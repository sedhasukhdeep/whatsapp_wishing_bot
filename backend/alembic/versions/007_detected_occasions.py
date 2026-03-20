"""Add detected_occasions table and source_target_id to occasions

Revision ID: 007
Revises: 006
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "detected_occasions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("message_id", sa.String(100), nullable=False, unique=True),
        sa.Column("source_chat_id", sa.String(100), nullable=False),
        sa.Column("source_chat_name", sa.String(100), nullable=True),
        sa.Column("raw_message", sa.Text, nullable=False),
        sa.Column("detected_name", sa.String(255), nullable=False),
        sa.Column("occasion_type", sa.String(50), nullable=False),
        sa.Column("occasion_label", sa.String(100), nullable=True),
        sa.Column("detected_month", sa.SmallInteger, nullable=True),
        sa.Column("detected_day", sa.SmallInteger, nullable=True),
        sa.Column("detected_year", sa.SmallInteger, nullable=True),
        sa.Column("confidence", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("matched_contact_id", sa.Integer, sa.ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("match_score", sa.SmallInteger, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_occasion_id", sa.Integer, sa.ForeignKey("occasions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_detected_occasions_status_created", "detected_occasions", ["status", "created_at"])

    with op.batch_alter_table("occasions") as batch_op:
        batch_op.add_column(sa.Column("source_target_id", sa.Integer, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("occasions") as batch_op:
        batch_op.drop_column("source_target_id")
    op.drop_index("ix_detected_occasions_status_created", table_name="detected_occasions")
    op.drop_table("detected_occasions")
