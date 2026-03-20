"""Add alias and use_alias_in_broadcast to contacts

Revision ID: 005
Revises: 004
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("contacts", sa.Column("alias", sa.String(100), nullable=True))
    op.add_column("contacts", sa.Column("use_alias_in_broadcast", sa.Boolean, nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("contacts", "use_alias_in_broadcast")
    op.drop_column("contacts", "alias")
