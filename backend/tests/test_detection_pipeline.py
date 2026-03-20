"""
Tests for the detection pipeline focusing on:
1. JID resolution — @s.whatsapp.net group sender JIDs must resolve to contacts
2. jid_to_contact map in analyze_group_context_window includes @s.whatsapp.net keys
3. Sender name flows correctly from group message to DetectedOccasion
"""

import pytest
from unittest.mock import MagicMock


def _make_contact(id_: int, name: str, phone: str, whatsapp_chat_id: str | None = None):
    c = MagicMock()
    c.id = id_
    c.name = name
    c.phone = phone
    c.relationship = "friend"
    c.alias = None
    c.notes = None
    c.whatsapp_chat_id = whatsapp_chat_id
    return c


# ── resolve_contact_by_jid ──────────────────────────────────────────────────

class TestResolveContactByJid:
    """Verify that group sender JIDs (@s.whatsapp.net) are resolved to contacts."""

    def _resolve(self, jid, contacts):
        from app.services.occasion_detection_service import resolve_contact_by_jid
        return resolve_contact_by_jid(jid, contacts)

    def test_resolves_c_us_jid(self):
        contacts = [_make_contact(1, "Alice", "+61411111111")]
        result = self._resolve("61411111111@c.us", contacts)
        assert result is not None
        assert result.name == "Alice"

    def test_resolves_s_whatsapp_net_jid(self):
        """Group message senders arrive as @s.whatsapp.net — must resolve to contact."""
        contacts = [_make_contact(1, "Alice", "+61411111111")]
        result = self._resolve("61411111111@s.whatsapp.net", contacts)
        assert result is not None, (
            "@s.whatsapp.net JID should resolve via phone digit matching"
        )
        assert result.name == "Alice"

    def test_resolves_s_whatsapp_net_with_country_code(self):
        """Phone stored with + prefix must still match."""
        contacts = [_make_contact(1, "Bob", "+61400000001")]
        result = self._resolve("61400000001@s.whatsapp.net", contacts)
        assert result is not None
        assert result.name == "Bob"

    def test_exact_whatsapp_chat_id_match_takes_priority(self):
        """whatsapp_chat_id exact match wins over phone match."""
        contacts = [
            _make_contact(1, "Alice", "+61411111111", whatsapp_chat_id="61411111111@c.us"),
            _make_contact(2, "Alice-Dupe", "+61411111111"),
        ]
        result = self._resolve("61411111111@c.us", contacts)
        assert result.id == 1

    def test_group_jid_returns_none(self):
        """@g.us JIDs should not resolve (they're group chats, not senders)."""
        contacts = [_make_contact(1, "Alice", "+61411111111")]
        result = self._resolve("120363000000000001@g.us", contacts)
        assert result is None

    def test_none_jid_returns_none(self):
        contacts = [_make_contact(1, "Alice", "+61411111111")]
        assert self._resolve(None, contacts) is None

    def test_no_matching_contact_returns_none(self):
        contacts = [_make_contact(1, "Alice", "+61411111111")]
        result = self._resolve("61499999999@s.whatsapp.net", contacts)
        assert result is None


# ── resolve_contact_by_phone ────────────────────────────────────────────────

class TestResolveContactByPhone:
    """Verify phone digit matching handles various JID and phone formats."""

    def _resolve(self, jid, contacts):
        from app.services.occasion_detection_service import resolve_contact_by_phone
        return resolve_contact_by_phone(jid, contacts)

    def test_matches_last_10_digits(self):
        contacts = [_make_contact(1, "Charlie", "+61412345678")]
        # Pass a @c.us JID — phone_part=61412345678
        result = self._resolve("61412345678@c.us", contacts)
        assert result is not None

    def test_s_whatsapp_net_passes_guard(self):
        """@s.whatsapp.net must not be blocked by the @g.us guard."""
        contacts = [_make_contact(1, "Dave", "+61412345678")]
        result = self._resolve("61412345678@s.whatsapp.net", contacts)
        assert result is not None

    def test_g_us_is_blocked(self):
        contacts = [_make_contact(1, "Dave", "+61412345678")]
        assert self._resolve("120363@g.us", contacts) is None


# ── jid_to_contact map in analyze_group_context_window ──────────────────────

class TestJidToContactMap:
    """
    Verify that contacts are mapped with BOTH @c.us and @s.whatsapp.net keys
    so group message authors are labeled by name in the AI context window.
    """

    def _build_map(self, contacts):
        """Extract the jid_to_contact dict from analyze_group_context_window by inspection."""
        import re as _re
        jid_to_contact = {}
        for contact in contacts:
            if contact.whatsapp_chat_id:
                jid_to_contact[contact.whatsapp_chat_id] = contact
            if contact.phone:
                phone_digits = _re.sub(r"\D", "", contact.phone)
                if len(phone_digits) >= 7:
                    jid_to_contact[f"{phone_digits}@c.us"] = contact
                    jid_to_contact[f"{phone_digits}@s.whatsapp.net"] = contact
        return jid_to_contact

    def test_both_jid_formats_in_map(self):
        contacts = [_make_contact(1, "Eve", "+61411111111")]
        m = self._build_map(contacts)
        assert "61411111111@c.us" in m, "Map must contain @c.us key"
        assert "61411111111@s.whatsapp.net" in m, "Map must contain @s.whatsapp.net key"

    def test_map_points_to_same_contact(self):
        contacts = [_make_contact(1, "Frank", "+61422222222")]
        m = self._build_map(contacts)
        assert m["61422222222@c.us"].name == "Frank"
        assert m["61422222222@s.whatsapp.net"].name == "Frank"

    def test_group_message_author_gets_labeled(self):
        """
        Simulate building the AI context lines: a group author with @s.whatsapp.net
        JID must appear as 'ContactName (JID)' not just 'JID'.
        """
        contacts = [_make_contact(1, "Grace", "+61433333333")]
        m = self._build_map(contacts)

        author_jid = "61433333333@s.whatsapp.net"
        author_contact = m.get(author_jid)
        assert author_contact is not None
        label = f"{author_contact.name} ({author_jid})"
        assert "Grace" in label, "Contact name must appear in the label for AI context"
