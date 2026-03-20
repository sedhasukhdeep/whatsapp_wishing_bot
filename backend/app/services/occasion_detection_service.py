"""
Scans incoming WhatsApp messages for occasion mentions (birthdays, anniversaries, etc.),
fuzzy-matches detected names against existing contacts, and creates DetectedOccasion
records for user review.

Uses the app-wide AI provider (configured in Settings) via call_ai_raw.
"""

import json
import logging
import re
from difflib import SequenceMatcher
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Keywords that suggest an occasion message — cheap pre-filter before AI call
_OCCASION_PATTERN = re.compile(
    r"\b(birthday|bday|b-day|born|anniversary|anni|happy\s+\w+|congrats|wishing|"
    r"feliz|geburtstag|anniversaire|complean|cumple)\b",
    re.IGNORECASE,
)

DETECTION_SYSTEM_PROMPT = (
    "You analyze WhatsApp messages to detect explicit occasion wishes. "
    "Return raw JSON only — no markdown, no explanation, no preamble.\n\n"
    'If the message is wishing someone a special occasion, return:\n'
    '{"detected":true,"name":"<person name>","occasion_type":"birthday|anniversary|custom",'
    '"occasion_label":null,"month":<int or null>,"day":<int or null>,"year":<int or null>,'
    '"confidence":"high|medium|low"}\n\n'
    'Otherwise return: {"detected":false}\n\n'
    "Rules:\n"
    "- Only detect EXPLICIT wishes (e.g. 'Happy birthday John!', 'Wishing you a happy anniversary').\n"
    "- Do NOT detect vague references like 'it's someone's birthday today'.\n"
    "- Extract the date only if clearly stated (e.g. 'March 15', 'on the 20th').\n"
    "- If the name is unclear or missing, set name to empty string and confidence to 'low'."
)

# Strip <think>/<thinking> blocks that local reasoning models sometimes emit before JSON
_THINKING_TAG_RE = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>\s*", re.DOTALL | re.IGNORECASE)


def is_likely_occasion_message(text: str) -> bool:
    """Cheap keyword pre-filter — returns True only if the message may mention an occasion."""
    return bool(_OCCASION_PATTERN.search(text))


def _parse_detection_response(raw: str) -> dict | None:
    """Strip thinking tags and parse JSON from the AI response."""
    cleaned = _THINKING_TAG_RE.sub("", raw).strip()
    # Some models wrap JSON in ```json ... ``` fences
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.DOTALL).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Occasion detection: failed to parse AI response as JSON: %r", cleaned[:200])
        return None


async def detect_occasion_from_message(text: str, db) -> dict | None:
    """
    Run AI detection on a message using the app-wide configured AI provider.
    Returns a detection dict or None if no occasion detected / AI unavailable.
    """
    from app.services.claude_service import call_ai_raw

    try:
        raw = await call_ai_raw(DETECTION_SYSTEM_PROMPT, text, db=db, max_tokens=200)
    except Exception as e:
        logger.warning("Occasion detection: AI call failed (%s) — skipping", e)
        return None

    result = _parse_detection_response(raw)
    if not result or not result.get("detected"):
        return None
    return result


def fuzzy_match_contact(name: str, db) -> tuple:
    """
    Fuzzy-match a detected name against all contacts (name + alias).
    Returns (contact, score) if best score >= 60, else (None, 0).
    """
    from app.models.contact import Contact

    if not name:
        return None, 0

    name_lower = name.lower()
    contacts = db.query(Contact).all()
    best_contact = None
    best_score = 0

    for c in contacts:
        score = int(SequenceMatcher(None, name_lower, c.name.lower()).ratio() * 100)
        if c.alias:
            alias_score = int(SequenceMatcher(None, name_lower, c.alias.lower()).ratio() * 100)
            score = max(score, alias_score)
        if score > best_score:
            best_score = score
            best_contact = c

    if best_score >= 60:
        return best_contact, best_score
    return None, 0


def is_duplicate_detection(
    message_id: str,
    matched_contact_id: int | None,
    occasion_type: str,
    detected_month: int | None,
    detected_day: int | None,
    db,
) -> bool:
    """
    Returns True if this detection is a duplicate:
    - Same message_id already exists (exact duplicate), OR
    - A confirmed detection for the same contact + occasion_type + month/day within 365 days.
    """
    from app.models.detected_occasion import DetectedOccasion

    if db.query(DetectedOccasion).filter(DetectedOccasion.message_id == message_id).first():
        return True

    if matched_contact_id and detected_month and detected_day:
        cutoff = datetime.now(timezone.utc) - timedelta(days=365)
        existing = (
            db.query(DetectedOccasion)
            .filter(
                DetectedOccasion.matched_contact_id == matched_contact_id,
                DetectedOccasion.occasion_type == occasion_type,
                DetectedOccasion.detected_month == detected_month,
                DetectedOccasion.detected_day == detected_day,
                DetectedOccasion.status == "confirmed",
                DetectedOccasion.created_at >= cutoff,
            )
            .first()
        )
        if existing:
            return True

    return False


async def process_message_for_occasion(chat_id: str, message_id: str, body: str, db) -> None:
    """
    Full detection pipeline: pre-filter → dedupe → AI detect → fuzzy match → persist.
    Designed to be called from the webhook; all failures are caught and logged.
    """
    from app.models.detected_occasion import DetectedOccasion

    if not is_likely_occasion_message(body):
        return

    # Check message_id deduplication before any AI call
    if db.query(DetectedOccasion).filter(DetectedOccasion.message_id == message_id).first():
        return

    result = await detect_occasion_from_message(body, db)
    if not result:
        return

    detected_name = result.get("name", "").strip()
    occasion_type = result.get("occasion_type", "custom")
    occasion_label = result.get("occasion_label")
    detected_month = result.get("month")
    detected_day = result.get("day")
    detected_year = result.get("year")
    confidence = result.get("confidence", "medium")

    matched_contact, match_score = fuzzy_match_contact(detected_name, db)
    matched_contact_id = matched_contact.id if matched_contact else None

    if is_duplicate_detection(message_id, matched_contact_id, occasion_type, detected_month, detected_day, db):
        return

    detection = DetectedOccasion(
        message_id=message_id,
        source_chat_id=chat_id,
        raw_message=body[:2000],
        detected_name=detected_name,
        occasion_type=occasion_type,
        occasion_label=occasion_label,
        detected_month=detected_month,
        detected_day=detected_day,
        detected_year=detected_year,
        confidence=confidence,
        matched_contact_id=matched_contact_id,
        match_score=match_score if match_score else None,
        status="pending",
    )
    db.add(detection)
    db.commit()
    logger.info(
        "Detected %s for '%s' (confidence=%s, contact_match=%s) in chat %s",
        occasion_type, detected_name, confidence,
        matched_contact.name if matched_contact else "none",
        chat_id,
    )
