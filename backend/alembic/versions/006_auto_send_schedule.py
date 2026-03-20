"""Add auto_send/use_alias to contacts; scheduled_for to message_drafts

Revision ID: 006
Revises: 005
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contacts", sa.Column("auto_send", sa.Boolean, nullable=False, server_default="0"))
    op.add_column("contacts", sa.Column("use_alias", sa.Boolean, nullable=False, server_default="0"))
    op.add_column("message_drafts", sa.Column("scheduled_for", sa.DateTime, nullable=True))


def downgrade() -> None:
    op.drop_column("message_drafts", "scheduled_for")
    op.drop_column("contacts", "use_alias")
    op.drop_column("contacts", "auto_send")
