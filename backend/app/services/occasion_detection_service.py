"""
Scans incoming WhatsApp messages for occasion mentions (birthdays, anniversaries, etc.),
fuzzy-matches detected names against existing contacts, and creates DetectedOccasion
records for user review.
"""

import json
import logging
import re
from difflib import SequenceMatcher
from datetime import datetime, timezone, timedelta

import anthropic

from app.config import settings as env_settings

logger = logging.getLogger(__name__)

DETECTION_MODEL = "claude-3-5-haiku-20241022"

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


def is_likely_occasion_message(text: str) -> bool:
    """Cheap keyword pre-filter — returns True only if the message may mention an occasion."""
    return bool(_OCCASION_PATTERN.search(text))


async def _call_detection_ai(text: str, api_key: str) -> dict | None:
    """Call Claude Haiku with the detection prompt. Returns parsed dict or None on failure."""
    client = anthropic.AsyncAnthropic(api_key=api_key, timeout=30.0)
    try:
        response = await client.messages.create(
            model=DETECTION_MODEL,
            max_tokens=200,
            system=DETECTION_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": text}],
        )
        raw = next((b.text for b in response.content if b.type == "text"), "")
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        logger.warning("Occasion detection: failed to parse AI response as JSON")
        return None
    except Exception as e:
        logger.warning("Occasion detection: AI call failed: %s", e)
        return None


async def detect_occasion_from_message(text: str, db) -> dict | None:
    """
    Run AI detection on a message. Returns a detection dict or None if:
    - no occasion detected
    - AI call fails
    - Anthropic API key not configured
    """
    from app.models.admin_setting import AdminSetting

    rows = {r.key: r.value for r in db.query(AdminSetting).all() if r.value}
    api_key = rows.get("anthropic_api_key") or env_settings.anthropic_api_key
    if not api_key:
        logger.warning("Occasion detection: no Anthropic API key configured — skipping")
        return None

    result = await _call_detection_ai(text, api_key)
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
    - A confirmed detection for the same contact + occasion_type + month/day exists within 365 days.
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

    # Check message_id deduplification before any AI call
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
        raw_message=body[:2000],  # cap raw message length
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
