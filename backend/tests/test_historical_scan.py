"""
Tests for historical scan using the multi-step detection pipeline.

Verifies that _run_scan calls process_message_for_occasion for every message
in both group chats (@g.us) and 1:1 chats (@c.us), and that the old
day-window clustering (scan_group_chat_for_occasions) is NOT invoked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


def _make_messages(n: int, chat_id: str = "111@g.us") -> list[dict]:
    return [
        {
            "id": f"msg_{i}",
            "body": "Happy birthday!",
            "timestamp": 1700000000 + i * 3600,
            "author": f"9990{i}@s.whatsapp.net" if "@g.us" in chat_id else None,
            "sender_name": f"Person {i}",
        }
        for i in range(n)
    ]


def _mock_db():
    db = MagicMock()
    db.query.return_value.count.return_value = 0
    return db


@pytest.mark.asyncio
async def test_group_chat_uses_process_message_per_message():
    """Group chats must be processed message-by-message, not via day-window clustering."""
    chat_id = "120363000000000001@g.us"
    messages = _make_messages(3, chat_id)

    with (
        patch("app.routers.detected_occasions.SessionLocal", return_value=_mock_db()),
        patch(
            "app.services.whatsapp_service.get_chat_messages",
            new=AsyncMock(return_value=("Test Group", messages)),
        ),
        patch(
            "app.services.occasion_detection_service.process_message_for_occasion",
            new=AsyncMock(),
        ) as mock_process,
        patch(
            "app.services.occasion_detection_service.scan_group_chat_for_occasions",
            new=AsyncMock(),
        ) as mock_window,
    ):
        from app.routers.detected_occasions import _run_scan
        await _run_scan([chat_id], limit_per_chat=50)

        assert mock_process.call_count == len(messages)
        mock_window.assert_not_called()


@pytest.mark.asyncio
async def test_one_to_one_chat_uses_process_message_per_message():
    """1:1 chats must be processed message-by-message."""
    chat_id = "61400000001@c.us"
    messages = _make_messages(2, chat_id)

    with (
        patch("app.routers.detected_occasions.SessionLocal", return_value=_mock_db()),
        patch(
            "app.services.whatsapp_service.get_chat_messages",
            new=AsyncMock(return_value=("Alice", messages)),
        ),
        patch(
            "app.services.occasion_detection_service.process_message_for_occasion",
            new=AsyncMock(),
        ) as mock_process,
    ):
        from app.routers.detected_occasions import _run_scan
        await _run_scan([chat_id], limit_per_chat=50)

        assert mock_process.call_count == len(messages)


@pytest.mark.asyncio
async def test_process_called_with_correct_args():
    """process_message_for_occasion receives the right arguments for each group message."""
    chat_id = "120363000000000001@g.us"
    messages = [
        {
            "id": "abc123",
            "body": "Happy birthday John!",
            "timestamp": 1700000000,
            "author": "61411111111@s.whatsapp.net",
            "sender_name": "Jane",
        }
    ]
    db = _mock_db()

    with (
        patch("app.routers.detected_occasions.SessionLocal", return_value=db),
        patch(
            "app.services.whatsapp_service.get_chat_messages",
            new=AsyncMock(return_value=("Family Group", messages)),
        ),
        patch(
            "app.services.occasion_detection_service.process_message_for_occasion",
            new=AsyncMock(),
        ) as mock_process,
    ):
        from app.routers.detected_occasions import _run_scan
        await _run_scan([chat_id], limit_per_chat=50)

        mock_process.assert_called_once_with(
            chat_id,
            "abc123",
            "Happy birthday John!",
            db,
            timestamp=1700000000,
            chat_name="Family Group",
            sender_jid="61411111111@s.whatsapp.net",
            sender_name="Jane",
        )


@pytest.mark.asyncio
async def test_scan_state_tracked_correctly():
    """Scan state counters increment correctly across multiple chats."""
    import app.routers.detected_occasions as router_mod

    chats = ["111@g.us", "222@g.us", "333@c.us"]
    msgs_per_chat = 2
    router_mod._scan_state = {"running": False, "scanned": 0, "detected": 0, "total": 0, "error": None}

    with (
        patch("app.routers.detected_occasions.SessionLocal", return_value=_mock_db()),
        patch(
            "app.services.whatsapp_service.get_chat_messages",
            new=AsyncMock(
                side_effect=lambda cid, limit: (f"Chat {cid}", _make_messages(msgs_per_chat, cid))
            ),
        ),
        patch(
            "app.services.occasion_detection_service.process_message_for_occasion",
            new=AsyncMock(),
        ) as mock_process,
    ):
        from app.routers.detected_occasions import _run_scan
        await _run_scan(chats, limit_per_chat=50)

        assert router_mod._scan_state["scanned"] == len(chats)
        assert router_mod._scan_state["running"] is False
        assert mock_process.call_count == len(chats) * msgs_per_chat
