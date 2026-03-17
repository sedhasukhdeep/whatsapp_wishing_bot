"""
AI message generation service.
Supports Claude (Anthropic) and any OpenAI-compatible local model (LM Studio, Ollama).
Provider selection via AI_PROVIDER env var: "auto" | "claude" | "local"
  auto  — tries local first (2s timeout), falls back to Claude
  local — local only (error if unavailable)
  claude — Claude only
"""

import logging
from datetime import date

import anthropic
import httpx
from openai import AsyncOpenAI

from app.config import settings
from app.models.contact import Contact
from app.models.occasion import Occasion
from app.services.occasion_service import build_occasion_display

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a warm, thoughtful assistant who writes personal greeting messages for WhatsApp. "
    "Your messages should feel genuine and human — never generic or copy-paste sounding. "
    "Write ONLY the message text itself with no preamble, no subject line, no sign-off label. "
    "Do not include 'Message:' or quotes around the output."
)

LENGTH_GUIDE = {"short": "~30 words", "medium": "~60 words", "long": "~100 words"}


def _build_prompt(contact: Contact, occasion: Occasion, on_date: date) -> str:
    occasion_display = build_occasion_display(occasion, on_date)

    # Occasion-level overrides take priority over contact defaults
    tone = occasion.tone_override or contact.tone_preference
    language = occasion.language_override or contact.language
    length = occasion.length_override or contact.message_length
    instructions = occasion.custom_instructions_override or contact.custom_instructions

    length_hint = LENGTH_GUIDE.get(length, "~60 words")

    lines = [
        "Write a WhatsApp greeting message with these parameters:",
        "",
        f"Recipient: {contact.name}",
        f"Relationship to sender: {contact.relationship}",
        f"Occasion: {occasion_display}",
        f"Tone: {tone}",
        f"Language: {language}",
        f"Length: {length} ({length_hint})",
    ]
    if contact.notes:
        lines += ["", f"Personal notes about {contact.name}: {contact.notes}",
                  "Use these details to make the message more personal."]
    if instructions:
        lines += ["", f"Additional instructions: {instructions}"]

    return "\n".join(lines)


async def _detect_local_model() -> str | None:
    """Returns model name if a local AI is reachable, else None."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(
                f"{settings.local_ai_url}/models",
                headers={"Authorization": "Bearer not-needed"},
            )
            if resp.status_code == 200:
                models = resp.json().get("data", [])
                if models:
                    if settings.local_ai_model:
                        return settings.local_ai_model
                    return models[0]["id"]
    except Exception:
        pass
    return None


async def _generate_local(prompt: str, model: str) -> str:
    client = AsyncOpenAI(base_url=settings.local_ai_url, api_key="not-needed")
    response = await client.chat.completions.create(
        model=model,
        max_tokens=300,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )
    return response.choices[0].message.content.strip()


async def _generate_claude(prompt: str) -> str:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=30.0)
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


async def generate_message(contact: Contact, occasion: Occasion, on_date: date) -> tuple[str, str]:
    """Returns (generated_text, prompt_used)."""
    prompt = _build_prompt(contact, occasion, on_date)
    provider = settings.ai_provider

    if provider == "local":
        model = await _detect_local_model()
        if not model:
            raise RuntimeError("Local AI provider configured but no local model is available. "
                               "Start LM Studio or Ollama and load a model.")
        logger.info("Using local AI model: %s", model)
        text = await _generate_local(prompt, model)
        return text, prompt

    if provider == "claude":
        text = await _generate_claude(prompt)
        return text, prompt

    # auto: try local first, fall back to Claude
    model = await _detect_local_model()
    if model:
        try:
            logger.info("Auto: using local AI model: %s", model)
            text = await _generate_local(prompt, model)
            return text, prompt
        except Exception as e:
            logger.warning("Local AI failed (%s), falling back to Claude", e)

    logger.info("Auto: using Claude")
    text = await _generate_claude(prompt)
    return text, prompt


async def get_ai_status() -> dict:
    """Returns current AI provider status for the frontend."""
    local_model = await _detect_local_model()
    return {
        "provider_setting": settings.ai_provider,
        "local_available": local_model is not None,
        "local_model": local_model,
        "local_url": settings.local_ai_url,
        "claude_configured": bool(settings.anthropic_api_key),
        "active_provider": (
            "local" if (settings.ai_provider == "local" or
                        (settings.ai_provider == "auto" and local_model))
            else "claude"
        ),
    }
