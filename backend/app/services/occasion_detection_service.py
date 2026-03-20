"""
Scans incoming WhatsApp messages for occasion mentions (birthdays, anniversaries, etc.),
uses AI to detect the occasion AND match the recipient against known contacts,
and creates DetectedOccasion records for user review.

Uses the app-wide AI provider (configured in Settings) via call_ai_raw.
"""

import json
import logging
import re
from datetime import datetime, timezone, timedelta, date as date_type

logger = logging.getLogger(__name__)

# Keywords that suggest an occasion message — cheap pre-filter before AI call
_OCCASION_PATTERN = re.compile(
    r"\b(birthday|bday|b-day|born|anniversary|anni|happy\s+\w+|congrats|wishing|"
    r"feliz|geburtstag|anniversaire|complean|cumple)\b",
    re.IGNORECASE,
)

DETECTION_SYSTEM_PROMPT = """You analyze WhatsApp messages to detect PERSONAL occasion wishes directed at a specific individual.

REJECT (return {"detected":false}) for:
- Generic public holiday messages NOT directed at a named/specific person:
  New Year, Christmas, Diwali, Holi, Eid, Navratri, Pongal, Baisakhi, Onam,
  Thanksgiving, Easter, Halloween, Valentine's Day (generic), Independence Day,
  Republic Day, or any festival/national holiday
- Messages wishing "everyone", "all", "the whole group", "the team", etc.
- Forwarded generic holiday greetings
- Vague references with no clear recipient (e.g. "someone has a birthday")

DETECT (return full JSON) only for explicit PERSONAL wishes like:
- "Happy birthday John!" → person: John
- "Happy anniversary Sarah and Mike!" → person: Sarah/Mike
- "Wishing you a happy birthday bro!" → detect, name unclear but specific person implied
- "Many happy returns of the day Priya!" → person: Priya

Given the contacts list below, identify which contact the message is wishing.
Match on: full name, first name, nickname, alias, relationship terms (bro/sis/didi/bhai/yaar/dude/buddy).

Return raw JSON only — no markdown, no explanation:
{"detected":true,"name":"<extracted name/nickname>","occasion_type":"birthday|anniversary|custom","occasion_label":null,"month":<int or null>,"day":<int or null>,"year":<int or null>,"confidence":"high|medium|low","matched_contact_id":<contact id int or null>}

or: {"detected":false}"""

# Strip <think>/<thinking> blocks that local reasoning models emit before JSON
_THINKING_TAG_RE = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>\s*", re.DOTALL | re.IGNORECASE)


def is_likely_occasion_message(text: str) -> bool:
    """Cheap keyword pre-filter — returns True only if the message may mention an occasion."""
    return bool(_OCCASION_PATTERN.search(text))


def _parse_detection_response(raw: str) -> dict | None:
    """Strip thinking tags and parse JSON from the AI response."""
    cleaned = _THINKING_TAG_RE.sub("", raw).strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.DOTALL).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Occasion detection: failed to parse AI response: %r", cleaned[:200])
        return None


def _build_contacts_context(contacts: list) -> str:
    """Format contacts list for the AI prompt."""
    if not contacts:
        return "No contacts available."
    lines = ["Contacts:"]
    for c in contacts:
        parts = [f"- ID {c.id}: {c.name} ({c.relationship})"]
        if c.alias:
            parts.append(f"alias: {c.alias}")
        if c.notes:
            # Include a short snippet of notes to help with context
            parts.append(f"notes: {c.notes[:80]}")
        lines.append(" | ".join(parts))
    return "\n".join(lines)


async def detect_occasion_from_message(text: str, contacts: list, db) -> dict | None:
    """
    Run AI detection on a message using the app-wide configured AI provider.
    Passes the contact list so the AI can intelligently match the recipient.
    Returns a detection dict or None if no occasion detected / AI unavailable.
    """
    from app.services.claude_service import call_ai_raw

    contacts_context = _build_contacts_context(contacts)
    user_message = f"{contacts_context}\n\nMessage: {text}"

    try:
        raw = await call_ai_raw(DETECTION_SYSTEM_PROMPT, user_message, db=db, max_tokens=250)
    except Exception as e:
        logger.warning("Occasion detection: AI call failed (%s) — skipping", e)
        return None

    result = _parse_detection_response(raw)
    if not result or not result.get("detected"):
        return None
    return result


def _validate_contact_id(contact_id, contacts: list) -> int | None:
    """Ensure the AI-returned contact_id actually exists in our contact list."""
    if contact_id is None:
        return None
    valid_ids = {c.id for c in contacts}
    try:
        cid = int(contact_id)
        return cid if cid in valid_ids else None
    except (TypeError, ValueError):
        return None


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


async def process_message_for_occasion(
    chat_id: str, message_id: str, body: str, db, timestamp: int | None = None
) -> None:
    """
    Full detection pipeline: pre-filter → dedupe → load contacts → AI detect+match → persist.
    timestamp: Unix epoch seconds from the message (used to infer occasion date when AI can't extract one).
    Designed to be called from the webhook; all failures are caught and logged.
    """
    from app.models.contact import Contact
    from app.models.detected_occasion import DetectedOccasion

    if not is_likely_occasion_message(body):
        return

    # Check message_id deduplication before any AI call
    if db.query(DetectedOccasion).filter(DetectedOccasion.message_id == message_id).first():
        return

    # Load contacts so the AI can match against them
    contacts = db.query(Contact).all()

    result = await detect_occasion_from_message(body, contacts, db)
    if not result:
        return

    detected_name = result.get("name", "").strip()
    occasion_type = result.get("occasion_type", "custom")
    occasion_label = result.get("occasion_label")
    detected_month = result.get("month")
    detected_day = result.get("day")
    detected_year = result.get("year")
    confidence = result.get("confidence", "medium")

    # If AI couldn't extract a date, fall back to the message send date
    if (detected_month is None or detected_day is None) and timestamp:
        msg_date = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        detected_month = detected_month or msg_date.month
        detected_day = detected_day or msg_date.day
        # Don't set year from timestamp — it's the occasion year (birth year), not current year

    # Use AI-suggested contact id (validated against actual contacts)
    matched_contact_id = _validate_contact_id(result.get("matched_contact_id"), contacts)
    matched_contact = next((c for c in contacts if c.id == matched_contact_id), None)

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
        match_score=None,  # AI-driven matching — no numeric score
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
