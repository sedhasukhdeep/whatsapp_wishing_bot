"""Fix contacts unique constraint: replace UNIQUE(phone) with UNIQUE(profile_id, phone)

Revision ID: 010
Revises: 009
Create Date: 2026-03-21
"""
from alembic import op

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite cannot ALTER TABLE to drop an inline UNIQUE constraint.
    # We recreate the table manually with the correct schema.
    op.execute("""
        CREATE TABLE contacts_new (
            id INTEGER NOT NULL PRIMARY KEY,
            profile_id INTEGER REFERENCES profiles (id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NOT NULL,
            relationship VARCHAR(50) NOT NULL,
            notes TEXT,
            tone_preference VARCHAR(20) NOT NULL DEFAULT 'warm',
            language VARCHAR(10) NOT NULL DEFAULT 'en',
            message_length VARCHAR(10) NOT NULL DEFAULT 'medium',
            custom_instructions TEXT,
            whatsapp_chat_id VARCHAR(100),
            whatsapp_chat_name VARCHAR(100),
            relationship_label VARCHAR(100),
            alias VARCHAR(100),
            use_alias_in_broadcast BOOLEAN NOT NULL DEFAULT '0',
            auto_send BOOLEAN NOT NULL DEFAULT '0',
            use_alias BOOLEAN NOT NULL DEFAULT '0',
            created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            UNIQUE (profile_id, phone)
        )
    """)
    op.execute("""
        INSERT INTO contacts_new
        SELECT id, profile_id, name, phone, relationship, notes,
               tone_preference, language, message_length, custom_instructions,
               whatsapp_chat_id, whatsapp_chat_name, relationship_label,
               alias, use_alias_in_broadcast, auto_send, use_alias,
               created_at, updated_at
        FROM contacts
    """)
    op.execute("DROP TABLE contacts")
    op.execute("ALTER TABLE contacts_new RENAME TO contacts")


def downgrade() -> None:
    op.execute("""
        CREATE TABLE contacts_new (
            id INTEGER NOT NULL PRIMARY KEY,
            profile_id INTEGER REFERENCES profiles (id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NOT NULL UNIQUE,
            relationship VARCHAR(50) NOT NULL,
            notes TEXT,
            tone_preference VARCHAR(20) NOT NULL DEFAULT 'warm',
            language VARCHAR(10) NOT NULL DEFAULT 'en',
            message_length VARCHAR(10) NOT NULL DEFAULT 'medium',
            custom_instructions TEXT,
            whatsapp_chat_id VARCHAR(100),
            whatsapp_chat_name VARCHAR(100),
            relationship_label VARCHAR(100),
            alias VARCHAR(100),
            use_alias_in_broadcast BOOLEAN NOT NULL DEFAULT '0',
            auto_send BOOLEAN NOT NULL DEFAULT '0',
            use_alias BOOLEAN NOT NULL DEFAULT '0',
            created_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
            updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        )
    """)
    op.execute("""
        INSERT INTO contacts_new
        SELECT id, profile_id, name, phone, relationship, notes,
               tone_preference, language, message_length, custom_instructions,
               whatsapp_chat_id, whatsapp_chat_name, relationship_label,
               alias, use_alias_in_broadcast, auto_send, use_alias,
               created_at, updated_at
        FROM contacts
    """)
    op.execute("DROP TABLE contacts")
    op.execute("ALTER TABLE contacts_new RENAME TO contacts")
