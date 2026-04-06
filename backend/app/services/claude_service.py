"""
AI message generation service.
Supports Claude (Anthropic), OpenAI, Google Gemini, and any OpenAI-compatible
local model (LM Studio, Ollama).

Provider selection via AI_PROVIDER env var or DB admin settings:
  "auto"   — tries local first (2s timeout), falls back to Claude
  "claude" — Claude (Anthropic) only
  "openai" — OpenAI only
  "gemini" — Google Gemini only
  "local"  — local OpenAI-compatible model only (LM Studio / Ollama)
"""

import logging
import re
from datetime import date

import anthropic
import httpx
from openai import AsyncOpenAI

from app.config import settings as env_settings
from app.models.contact import Contact
from app.models.occasion import Occasion
from app.services.occasion_service import build_occasion_display

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You write WhatsApp greeting messages. "
    "Your entire response IS the message — output nothing else. "
    "No preamble, no labels, no analysis, no drafts, no word counts. "
    "Start writing the message immediately."
)

LENGTH_GUIDE = {"short": "~30 words", "medium": "~60 words", "long": "~100 words"}

DEFAULT_CLAUDE_MODEL = "claude-3-5-haiku-20241022"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"


def _get_effective_settings(db=None) -> dict:
    """Returns AI settings from DB (if db provided), falling back to env vars."""
    if db is not None:
        from app.models.admin_setting import AdminSetting
        rows = {r.key: r.value for r in db.query(AdminSetting).all() if r.value}
        return {
            "ai_provider": rows.get("ai_provider") or env_settings.ai_provider,
            "anthropic_api_key": rows.get("anthropic_api_key") or env_settings.anthropic_api_key,
            "claude_model": rows.get("claude_model") or DEFAULT_CLAUDE_MODEL,
            "openai_api_key": rows.get("openai_api_key") or env_settings.openai_api_key,
            "openai_model": rows.get("openai_model") or env_settings.openai_model or DEFAULT_OPENAI_MODEL,
            "gemini_api_key": rows.get("gemini_api_key") or env_settings.gemini_api_key,
            "gemini_model": rows.get("gemini_model") or env_settings.gemini_model or DEFAULT_GEMINI_MODEL,
            "local_ai_url": rows.get("local_ai_url") or env_settings.local_ai_url,
            "local_ai_model": rows.get("local_ai_model") or env_settings.local_ai_model,
        }
    return {
        "ai_provider": env_settings.ai_provider,
        "anthropic_api_key": env_settings.anthropic_api_key,
        "claude_model": DEFAULT_CLAUDE_MODEL,
        "openai_api_key": env_settings.openai_api_key,
        "openai_model": env_settings.openai_model or DEFAULT_OPENAI_MODEL,
        "gemini_api_key": env_settings.gemini_api_key,
        "gemini_model": env_settings.gemini_model or DEFAULT_GEMINI_MODEL,
        "local_ai_url": env_settings.local_ai_url,
        "local_ai_model": env_settings.local_ai_model,
    }


def _build_prompt(
    contact: Contact, occasion: Occasion, on_date: date, extra_context: str | None = None
) -> str:
    occasion_display = build_occasion_display(occasion, on_date)

    # Occasion-level overrides take priority over contact defaults
    tone = occasion.tone_override or contact.tone_preference
    language = occasion.language_override or contact.language
    length = occasion.length_override or contact.message_length
    instructions = occasion.custom_instructions_override or contact.custom_instructions

    length_hint = LENGTH_GUIDE.get(length, "~60 words")

    # Use alias in the AI prompt if configured
    display_name = contact.alias if (contact.alias and contact.use_alias) else contact.name

    is_anniversary = occasion.type == "anniversary"

    if is_anniversary:
        if contact.partner_name:
            # Explicit partner name — address both by name
            parts = [
                f"Write a {tone} {occasion_display} WhatsApp message for {display_name} and {contact.partner_name} ({contact.relationship}).",
                f"The message should warmly celebrate both of them together.",
                f"Language: {language}. Length: {length_hint}.",
            ]
        else:
            # No explicit partner — let the AI infer the counterpart from the name/alias.
            # e.g. "Chachu ji" → "Chachi ji", "Mama ji" → "Mami ji", "Nana ji" → "Nani ji"
            parts = [
                f"Write a {tone} {occasion_display} WhatsApp message for {display_name} ({contact.relationship}).",
                f"This is an anniversary — naturally include and celebrate both partners in the message.",
                f"If the name or alias implies a specific family title (e.g. 'Chachu ji' implies 'Chachi ji', 'Mama ji' implies 'Mami ji', 'Nana ji' implies 'Nani ji', 'Dada ji' implies 'Dadi ji'), use the corresponding form for the partner naturally.",
                f"Language: {language}. Length: {length_hint}.",
            ]
    else:
        parts = [
            f"Write a {tone} {occasion_display} WhatsApp message for {display_name} ({contact.relationship}).",
            f"Language: {language}. Length: {length_hint}.",
        ]

    if contact.notes:
        parts.append(f"Personal details to weave in: {contact.notes}.")
    if instructions:
        parts.append(instructions)
    if extra_context:
        parts.append(f"Additional instructions: {extra_context}")

    return " ".join(parts)


async def _detect_local_model(local_ai_url: str, local_ai_model: str) -> str | None:
    """Returns model name if a local AI is reachable, else None."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(
                f"{local_ai_url}/models",
                headers={"Authorization": "Bearer not-needed"},
            )
            if resp.status_code == 200:
                models = resp.json().get("data", [])
                if models:
                    if local_ai_model:
                        return local_ai_model
                    return models[0]["id"]
    except Exception:
        pass
    return None


async def _generate_claude(prompt: str, api_key: str, claude_model: str) -> str:
    client = anthropic.AsyncAnthropic(api_key=api_key, timeout=300.0)
    response = await client.messages.create(
        model=claude_model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    text_block = next(b for b in response.content if b.type == "text")
    return _extract_clean_message(text_block.text)


async def _generate_openai(prompt: str, api_key: str, model: str) -> str:
    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model=model,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )
    return _extract_clean_message(response.choices[0].message.content.strip())


async def _generate_gemini(prompt: str, api_key: str, model: str) -> str:
    import google.generativeai as genai  # type: ignore
    genai.configure(api_key=api_key)
    gemini_model = genai.GenerativeModel(
        model_name=model,
        system_instruction=SYSTEM_PROMPT,
    )
    response = await gemini_model.generate_content_async(prompt)
    return _extract_clean_message(response.text.strip())


async def _generate_local(prompt: str, model: str, local_ai_url: str) -> str:
    client = AsyncOpenAI(base_url=local_ai_url, api_key="not-needed", timeout=120.0)
    response = await client.chat.completions.create(
        model=model,
        max_tokens=800,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )
    text = response.choices[0].message.content.strip()
    return _extract_clean_message(text)


# Strips <think>/<thinking> blocks used by local reasoning models (Qwen3, DeepSeek-R1, etc.)
_THINKING_TAG_RE = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>\s*", re.DOTALL | re.IGNORECASE)

# Detects verbose thinking output (e.g. "Thinking Process:", "1. **Analyze...")
_VERBOSE_THINKING_RE = re.compile(r"thinking\s*process\s*:", re.IGNORECASE)

# Analysis line markers that signal end of message content
_ANALYSIS_SPLIT_RE = re.compile(
    r"\n\s*\*?(?:Word Count|Tone Check|Constraint|Count:)", re.IGNORECASE
)

# Inline draft block: "*Draft N:*\n   <message>"
_INLINE_DRAFT_RE = re.compile(
    r"\*Draft\s*\d+:\*\s*\n\s*(.*?)(?=\n\s*\*(?:Draft\s*\d|Word Count|Tone|Constraint)|\n\s*\d+\.\s|\Z)",
    re.DOTALL | re.IGNORECASE,
)

# Top-level "Drafting..." section
_DRAFTING_SECTION_RE = re.compile(
    r"\*{0,2}(?:Drafting|Draft\s*\d+)[^:]*:\*{0,2}[ \t]*\n(.*?)(?=\n[ \t]*\d+\.[ \t]|\Z)",
    re.DOTALL | re.IGNORECASE,
)


def _extract_clean_message(text: str) -> str:
    """Strip or extract the actual message from verbose thinking output."""
    # Remove XML-style thinking blocks first
    text = _THINKING_TAG_RE.sub("", text).strip()

    if not _VERBOSE_THINKING_RE.search(text):
        return text

    # 1. Look for an inline "*Draft N:*\n<message>" block anywhere in the text
    for m in _INLINE_DRAFT_RE.finditer(text):
        content = _ANALYSIS_SPLIT_RE.split(m.group(1))[0].strip()
        if len(content.split()) >= 10:
            return content

    # 2. Fallback: grab the Drafting section content and strip leading bullets
    for m in _DRAFTING_SECTION_RE.finditer(text):
        section = m.group(1)
        # Remove leading bullet/planning lines and keep only prose paragraphs
        paragraphs = re.split(r"\n{2,}", section)
        for para in paragraphs:
            para = para.strip()
            if para and not para.startswith("*") and len(para.split()) >= 10:
                return _ANALYSIS_SPLIT_RE.split(para)[0].strip()

    return text


async def _try_configured_providers(prompt: str, ai: dict) -> str:
    """Try Claude → OpenAI → Gemini in order, using whichever keys are configured.

    Raises RuntimeError if no provider succeeds.
    """
    errors: list[str] = []

    if ai.get("anthropic_api_key"):
        try:
            logger.info("Fallback: trying Claude")
            return await _generate_claude(prompt, ai["anthropic_api_key"], ai["claude_model"])
        except Exception as e:
            logger.warning("Fallback: Claude failed (%s)", e)
            errors.append(f"claude: {e}")

    if ai.get("openai_api_key"):
        try:
            logger.info("Fallback: trying OpenAI")
            return await _generate_openai(prompt, ai["openai_api_key"], ai["openai_model"])
        except Exception as e:
            logger.warning("Fallback: OpenAI failed (%s)", e)
            errors.append(f"openai: {e}")

    if ai.get("gemini_api_key"):
        try:
            logger.info("Fallback: trying Gemini")
            return await _generate_gemini(prompt, ai["gemini_api_key"], ai["gemini_model"])
        except Exception as e:
            logger.warning("Fallback: Gemini failed (%s)", e)
            errors.append(f"gemini: {e}")

    raise RuntimeError(
        "No AI provider is available. "
        + (f"Tried: {'; '.join(errors)}" if errors else "No API keys are configured.")
    )


async def _call_provider(prompt: str, ai: dict) -> str:
    """Routes to the correct AI provider and returns the generated text."""
    provider = ai["ai_provider"]

    if provider == "claude":
        return await _generate_claude(prompt, ai["anthropic_api_key"], ai["claude_model"])

    if provider == "openai":
        return await _generate_openai(prompt, ai["openai_api_key"], ai["openai_model"])

    if provider == "gemini":
        return await _generate_gemini(prompt, ai["gemini_api_key"], ai["gemini_model"])

    if provider == "local":
        model = await _detect_local_model(ai["local_ai_url"], ai["local_ai_model"])
        if model:
            try:
                logger.info("Using local AI provider")
                return await _generate_local(prompt, model, ai["local_ai_url"])
            except Exception as e:
                logger.warning("Local AI failed (%s), trying other providers", e)
        else:
            logger.warning("Local AI not available, trying other configured providers")
        return await _try_configured_providers(prompt, ai)

    # auto: try local first, then fall back to any configured cloud provider
    model = await _detect_local_model(ai["local_ai_url"], ai["local_ai_model"])
    if model:
        try:
            logger.info("Auto: using local AI provider")
            return await _generate_local(prompt, model, ai["local_ai_url"])
        except Exception as e:
            logger.warning("Auto: local AI failed (%s), trying other providers", e)

    return await _try_configured_providers(prompt, ai)


async def call_ai_raw(system_prompt: str, user_message: str, db=None, max_tokens: int = 512) -> str:
    """
    Call the configured AI provider with custom system/user prompts.
    Uses the same provider selection logic as generate_message.
    Returns the raw text response (no cleaning applied).
    Raises RuntimeError if no provider is available.
    """
    ai = _get_effective_settings(db)
    provider = ai["ai_provider"]

    async def _claude() -> str:
        client = anthropic.AsyncAnthropic(api_key=ai["anthropic_api_key"], timeout=60.0)
        response = await client.messages.create(
            model=ai["claude_model"],
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return next(b.text for b in response.content if b.type == "text")

    async def _openai() -> str:
        client = AsyncOpenAI(api_key=ai["openai_api_key"])
        response = await client.chat.completions.create(
            model=ai["openai_model"],
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content.strip()

    async def _gemini() -> str:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=ai["gemini_api_key"])
        gemini_model = genai.GenerativeModel(model_name=ai["gemini_model"], system_instruction=system_prompt)
        response = await gemini_model.generate_content_async(user_message)
        return response.text.strip()

    async def _local(model: str) -> str:
        client = AsyncOpenAI(base_url=ai["local_ai_url"], api_key="not-needed", timeout=120.0)
        response = await client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content.strip()

    async def _try_raw_fallbacks() -> str:
        errors: list[str] = []
        if ai.get("anthropic_api_key"):
            try:
                return await _claude()
            except Exception as e:
                errors.append(f"claude: {e}")
        if ai.get("openai_api_key"):
            try:
                return await _openai()
            except Exception as e:
                errors.append(f"openai: {e}")
        if ai.get("gemini_api_key"):
            try:
                return await _gemini()
            except Exception as e:
                errors.append(f"gemini: {e}")
        raise RuntimeError(
            "No AI provider is available. "
            + (f"Tried: {'; '.join(errors)}" if errors else "No API keys are configured.")
        )

    if provider == "claude":
        return await _claude()
    if provider == "openai":
        return await _openai()
    if provider == "gemini":
        return await _gemini()
    if provider == "local":
        model = await _detect_local_model(ai["local_ai_url"], ai["local_ai_model"])
        if model:
            try:
                return await _local(model)
            except Exception as e:
                logger.warning("call_ai_raw: local failed (%s), trying other providers", e)
        else:
            logger.warning("call_ai_raw: local not available, trying other providers")
        return await _try_raw_fallbacks()

    # auto: try local first, fall back to any configured provider
    model = await _detect_local_model(ai["local_ai_url"], ai["local_ai_model"])
    if model:
        try:
            return await _local(model)
        except Exception as e:
            logger.warning("call_ai_raw: local failed (%s), trying other providers", e)
    return await _try_raw_fallbacks()


async def generate_message(
    contact: Contact, occasion: Occasion, on_date: date, db=None, extra_context: str | None = None
) -> tuple[str, str]:
    """Returns (generated_text, prompt_used).

    extra_context: optional free-text instructions appended to the prompt,
    e.g. from the WhatsApp admin command 'regenerate #3 make it funnier'.
    """
    ai = _get_effective_settings(db)
    prompt = _build_prompt(contact, occasion, on_date, extra_context=extra_context)
    text = await _call_provider(prompt, ai)
    return text, prompt


async def generate_broadcast_message(occasion_name: str, db=None) -> tuple[str, str]:
    """Generate a broadcast message for a given occasion. Returns (text, prompt)."""
    ai = _get_effective_settings(db)
    prompt = (
        f"Write a warm, friendly WhatsApp message for {occasion_name}. "
        "This message will be sent to multiple people. "
        "Keep it general (no specific personal details). "
        "Language: English. Length: ~60 words."
    )
    text = await _call_provider(prompt, ai)
    return text, prompt


async def get_ai_status(db=None) -> dict:
    """Returns current AI provider status for the frontend."""
    ai = _get_effective_settings(db)
    local_model = await _detect_local_model(ai["local_ai_url"], ai["local_ai_model"])
    provider = ai["ai_provider"]

    if provider == "auto":
        active = "local" if local_model else "claude"
    else:
        active = provider

    return {
        "provider_setting": provider,
        "local_available": local_model is not None,
        "local_model": local_model,
        "local_url": ai["local_ai_url"],
        "claude_configured": bool(ai["anthropic_api_key"]),
        "claude_model": ai["claude_model"],
        "openai_configured": bool(ai["openai_api_key"]),
        "openai_model": ai["openai_model"],
        "gemini_configured": bool(ai["gemini_api_key"]),
        "gemini_model": ai["gemini_model"],
        "active_provider": active,
    }
