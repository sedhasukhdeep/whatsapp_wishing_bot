"""
Tests that generated messages contain no thinking/reasoning leakage.

A "thinking leak" is any of:
  - Raw <thinking>...</thinking> XML tags (extended thinking leaked into text)
  - Lines that start with reasoning markers ("Thinking:", "Let me think", etc.)
  - Empty string (generation failed silently)
"""

import re
import types
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

THINKING_PATTERNS = [
    re.compile(r"<thinking>", re.IGNORECASE),
    re.compile(r"</thinking>", re.IGNORECASE),
    re.compile(r"^\s*thinking\s*:", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*let me think", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*i need to (think|consider|analyze)", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*draft\s*:", re.IGNORECASE | re.MULTILINE),
    re.compile(r"^\s*reasoning\s*:", re.IGNORECASE | re.MULTILINE),
]


def has_thinking_leak(text: str) -> bool:
    return any(p.search(text) for p in THINKING_PATTERNS)


def _make_contact(name="Alice", relationship="friend", language="English",
                  tone_preference="warm", message_length="medium", notes="", custom_instructions=""):
    c = MagicMock()
    c.name = name
    c.relationship = relationship
    c.language = language
    c.tone_preference = tone_preference
    c.message_length = message_length
    c.notes = notes
    c.custom_instructions = custom_instructions
    return c


def _make_occasion(type_="birthday", label="Birthday", tone_override=None,
                   language_override=None, length_override=None, custom_instructions_override=None):
    o = MagicMock()
    o.type = type_
    o.label = label
    o.tone_override = tone_override
    o.language_override = language_override
    o.length_override = length_override
    o.custom_instructions_override = custom_instructions_override
    return o


def _make_anthropic_response(text: str):
    """Build a minimal mock of an Anthropic Messages response."""
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = text

    response = MagicMock()
    response.content = [text_block]
    return response


def _make_anthropic_response_with_thinking(thinking_text: str, message_text: str):
    """Simulate a response where the API returns a thinking block + text block."""
    thinking_block = MagicMock()
    thinking_block.type = "thinking"
    thinking_block.thinking = thinking_text

    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = message_text

    response = MagicMock()
    response.content = [thinking_block, text_block]
    return response


def _make_anthropic_response_thinking_in_text(thinking_text: str, message_text: str):
    """
    Simulate the bug: thinking leaked directly into the text block as XML tags,
    which happens when a model doesn't support structured thinking but the
    `thinking` parameter is still passed.
    """
    raw = f"<thinking>\n{thinking_text}\n</thinking>\n\n{message_text}"
    return _make_anthropic_response(raw)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_clean_response_passes():
    """A normal greeting message with no thinking content should pass."""
    from app.services.claude_service import _generate_claude

    clean_text = "Happy birthday, Alice! Wishing you a wonderful day filled with joy!"
    mock_response = _make_anthropic_response(clean_text)

    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("app.services.claude_service.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await _generate_claude("test prompt")

    assert result == clean_text
    assert not has_thinking_leak(result), "Clean response should not trigger thinking-leak check"


@pytest.mark.asyncio
async def test_structured_thinking_block_is_stripped():
    """
    When the API returns a proper thinking block + text block, only the text
    block should appear in the result.
    """
    from app.services.claude_service import _generate_claude

    thinking = "The user wants a birthday message for Alice..."
    message = "Happy birthday, Alice! Hope your day is amazing!"
    mock_response = _make_anthropic_response_with_thinking(thinking, message)

    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("app.services.claude_service.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await _generate_claude("test prompt")

    assert result == message
    assert thinking not in result
    assert not has_thinking_leak(result)


@pytest.mark.asyncio
async def test_thinking_xml_leaked_into_text_fails():
    """
    This test FAILS (by design) when thinking XML tags are present in the output.
    It documents the bug: if <thinking> leaks into the text block, the service
    must strip it before returning.
    """
    from app.services.claude_service import _generate_claude

    thinking = "I need to think about this birthday message carefully."
    message = "Happy birthday, Alice!"
    mock_response = _make_anthropic_response_thinking_in_text(thinking, message)

    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("app.services.claude_service.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await _generate_claude("test prompt")

    assert not has_thinking_leak(result), (
        f"Thinking content leaked into the generated message:\n\n{result!r}"
    )


@pytest.mark.asyncio
async def test_generate_message_no_thinking_leak():
    """
    End-to-end: generate_message() must never return text that contains
    thinking markers, regardless of what the underlying API returns.
    """
    from app.services.claude_service import generate_message

    contact = _make_contact()
    occasion = _make_occasion()

    clean_text = "Wishing you the happiest of birthdays, Alice!"
    mock_response = _make_anthropic_response(clean_text)

    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with (
        patch("app.services.claude_service.anthropic.AsyncAnthropic", return_value=mock_client),
        patch("app.services.claude_service._detect_local_model", AsyncMock(return_value=None)),
        patch("app.services.claude_service.settings") as mock_settings,
    ):
        mock_settings.ai_provider = "claude"
        mock_settings.anthropic_api_key = "test-key"
        text, prompt = await generate_message(contact, occasion, date(2026, 3, 18))

    assert text, "Generated text must not be empty"
    assert not has_thinking_leak(text), (
        f"Thinking content found in generate_message() output:\n\n{text!r}"
    )
