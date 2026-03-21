"""Add profiles table and profile_id to data tables for multi-user support

Revision ID: 009
Revises: 008
Create Date: 2026-03-21
"""
import sqlalchemy as sa
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create profiles table
    op.create_table(
        "profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("pin_hash", sa.String(255), nullable=True),
        sa.Column("wa_admin_chat_id", sa.String(100), nullable=True),
        sa.Column("wa_admin_chat_name", sa.String(100), nullable=True),
        sa.Column("notifications_enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # 2. Insert the default profile; migrate any existing admin chat settings into it
    op.execute(
        "INSERT INTO profiles (id, name, notifications_enabled) VALUES (1, 'Default', 1)"
    )
    # Copy admin chat settings from admin_settings into the default profile
    op.execute("""
        UPDATE profiles SET
            wa_admin_chat_id = (SELECT value FROM admin_settings WHERE key = 'admin_wa_chat_id'),
            wa_admin_chat_name = (SELECT value FROM admin_settings WHERE key = 'admin_wa_chat_name'),
            notifications_enabled = CASE
                WHEN (SELECT value FROM admin_settings WHERE key = 'admin_notifications_enabled') = 'true'
                THEN 1 ELSE 1 END
        WHERE id = 1
    """)

    # 3. Add profile_id to contacts (nullable → backfill → keep nullable with default)
    with op.batch_alter_table("contacts") as batch_op:
        batch_op.add_column(sa.Column("profile_id", sa.Integer(), nullable=True))
    op.execute("UPDATE contacts SET profile_id = 1")

    # 4. Add profile_id to whatsapp_targets
    with op.batch_alter_table("whatsapp_targets") as batch_op:
        batch_op.add_column(sa.Column("profile_id", sa.Integer(), nullable=True))
    op.execute("UPDATE whatsapp_targets SET profile_id = 1")

    # 5. Add profile_id to broadcasts
    with op.batch_alter_table("broadcasts") as batch_op:
        batch_op.add_column(sa.Column("profile_id", sa.Integer(), nullable=True))
    op.execute("UPDATE broadcasts SET profile_id = 1")

    # 6. Add profile_id to detected_occasions
    with op.batch_alter_table("detected_occasions") as batch_op:
        batch_op.add_column(sa.Column("profile_id", sa.Integer(), nullable=True))
    op.execute("UPDATE detected_occasions SET profile_id = 1")


def downgrade():
    with op.batch_alter_table("detected_occasions") as batch_op:
        batch_op.drop_column("profile_id")
    with op.batch_alter_table("broadcasts") as batch_op:
        batch_op.drop_column("profile_id")
    with op.batch_alter_table("whatsapp_targets") as batch_op:
        batch_op.drop_column("profile_id")
    with op.batch_alter_table("contacts") as batch_op:
        batch_op.drop_column("profile_id")
    op.drop_table("profiles")
