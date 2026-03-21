"""Remove auto-created default profile on fresh installs (no contacts)

For fresh installs, migration 009 inserted a "Default" profile with id=1 but
there is no existing user data. This migration removes it so users are prompted
to create their own profile.

For existing installs with contacts already assigned to profile_id=1 the
profile is NOT removed.

Revision ID: 011
Revises: 010
Create Date: 2026-03-21
"""
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    # Only delete the auto-seeded "Default" profile if it has no contacts —
    # i.e. this is a fresh install with nothing to migrate.
    op.execute("""
        DELETE FROM profiles
        WHERE id = 1
          AND name = 'Default'
          AND NOT EXISTS (SELECT 1 FROM contacts WHERE profile_id = 1)
    """)


def downgrade():
    pass
