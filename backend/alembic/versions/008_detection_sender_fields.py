"""Add sender_jid and sender_name to detected_occasions

Revision ID: 008
Revises: 007
Create Date: 2026-03-20
"""
import sqlalchemy as sa
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("detected_occasions") as batch_op:
        batch_op.add_column(sa.Column("sender_jid", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("sender_name", sa.String(255), nullable=True))


def downgrade():
    with op.batch_alter_table("detected_occasions") as batch_op:
        batch_op.drop_column("sender_name")
        batch_op.drop_column("sender_jid")
