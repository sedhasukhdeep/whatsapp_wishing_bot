"""
Scans incoming WhatsApp messages for occasion mentions (birthdays, anniversaries, etc.),
uses AI to detect the occasion AND match the recipient against known contacts,
and creates DetectedOccasion records for user review.

Multi-step contact resolution:
  1. 1:1 chat (@c.us): recipient IS the contact — resolved directly by phone number from JID.
  2. Group chat (@g.us), live message: AI-driven matching using full contact list.
  3. Group chat (@g.us), historical scan: context-window analysis; "thank you" pattern
     identifies the recipient by their author JID.

Uses the app-wide AI provider (configured in Settings) via call_ai_raw.
"""

import json
import logging
import re
from datetime import datetime, timezone, timedelta

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

GROUP_CONTEXT_SYSTEM_PROMPT = """You analyze a batch of WhatsApp GROUP messages to identify PERSONAL occasion celebrations.

THANK-YOU PATTERN (strongest signal):
The person who responds with "thank you", "thanks", "ty", "thnks", "thankyou", "🙏", "shukriya", "bahut shukriya", "thnx", "thx", "❤️" shortly after receiving birthday/anniversary wishes IS the recipient. Extract their JID from the [JID] label in the message line.

IGNORE entirely and return {"detected":false} if:
- A parent/family member says "thanks for wishing my son/beta/daughter/beti/bachcha/kid/child" — minor's celebration, skip
- Generic holiday messages (New Year, Diwali, Holi, Eid, Christmas, etc.)
- Multiple unrelated people being wished across different occasions
- No clear recipient identifiable

Each message line is formatted as:
  [me]: message text          ← your own sent message
  [Name (JID)]: message text  ← known contact (JID shown)
  [JID]: message text         ← unknown sender

Given the contacts list below, identify which contact is being celebrated.
Match on: full name, first name, nickname, alias, relationship terms.

Return raw JSON only — no markdown, no explanation:
{"detected":true,"name":"<name of person being celebrated>","occasion_type":"birthday|anniversary|custom","occasion_label":null,"month":<int or null>,"day":<int or null>,"year":<int or null>,"confidence":"high|medium|low","thanked_by_jid":"<full JID of who said thanks, or null>","matched_contact_id":<int or null>}

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
            parts.append(f"notes: {c.notes[:80]}")
        lines.append(" | ".join(parts))
    return "\n".join(lines)


def resolve_contact_by_phone(jid: str, contacts: list):
    """
    For a @c.us JID (1:1 chat), look up the contact by phone number.
    Matches on last 10 digits to handle country code variations.
    Returns the Contact or None.
    """
    if not jid or jid.endswith("@g.us") or jid.endswith("@broadcast"):
        return None
    phone_part = jid.split("@")[0]
    phone_digits = re.sub(r"\D", "", phone_part)
    if len(phone_digits) < 7:
        return None
    suffix = phone_digits[-10:]
    for contact in contacts:
        c_digits = re.sub(r"\D", "", contact.phone or "")
        if not c_digits or len(c_digits) < 7:
            continue
        if c_digits[-10:] == suffix or phone_digits[-10:] == c_digits[-10:]:
            return contact
    return None


def resolve_contact_by_jid(jid: str, contacts: list):
    """
    Resolve any JID to a contact — checks whatsapp_chat_id first, then phone digits.
    Used to match the "thanked_by_jid" from group context analysis.
    """
    if not jid:
        return None
    # Try whatsapp_chat_id exact match
    for contact in contacts:
        if contact.whatsapp_chat_id and contact.whatsapp_chat_id == jid:
            return contact
    # Fallback: phone digit match (for @c.us JIDs)
    if "@c.us" in jid:
        return resolve_contact_by_phone(jid, contacts)
    return None


async def detect_occasion_from_message(text: str, contacts: list, db) -> dict | None:
    """
    Run AI detection on a single message using the app-wide configured AI provider.
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


async def analyze_group_context_window(
    messages: list,  # list of {id, body, timestamp, from_me, author}
    contacts: list,
    db,
) -> dict | None:
    """
    Analyze a window of group messages (typically one day) to identify who is being celebrated.
    Uses the thank-you pattern: the person who says thanks is the birthday recipient.
    Returns a detection dict with optional 'thanked_by_jid', or None.
    """
    from app.services.claude_service import call_ai_raw

    if not messages:
        return None

    # Build JID → contact name map for labelling
    jid_to_contact = {}
    for contact in contacts:
        if contact.whatsapp_chat_id:
            jid_to_contact[contact.whatsapp_chat_id] = contact
        if contact.phone:
            phone_digits = re.sub(r"\D", "", contact.phone)
            if len(phone_digits) >= 7:
                jid_to_contact[f"{phone_digits}@c.us"] = contact

    # Format messages
    msg_lines = []
    for m in messages:
        author = m.get("author")
        if m.get("from_me"):
            label = "me"
        elif author and author in jid_to_contact:
            label = f"{jid_to_contact[author].name} ({author})"
        elif author:
            label = author
        else:
            label = "unknown"
        msg_lines.append(f"[{label}]: {m['body']}")

    window_date = ""
    if messages[0].get("timestamp"):
        dt = datetime.fromtimestamp(messages[0]["timestamp"], tz=timezone.utc)
        window_date = f" ({dt.strftime('%Y-%m-%d')})"

    contacts_context = _build_contacts_context(contacts)
    user_message = (
        f"{contacts_context}\n\n"
        f"Group messages{window_date}:\n"
        + "\n".join(msg_lines)
    )

    try:
        raw = await call_ai_raw(GROUP_CONTEXT_SYSTEM_PROMPT, user_message, db=db, max_tokens=300)
    except Exception as e:
        logger.warning("Group context analysis: AI call failed (%s) — skipping", e)
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
    Full detection pipeline: pre-filter → dedupe → load contacts → resolve/detect → persist.

    Step 1 (1:1 chat): If chat_id is @c.us, resolve the contact directly by phone number.
                       AI is still called to detect occasion type/date, but contact is locked.
    Step 2 (group chat): AI-driven detection + matching against full contact list.

    timestamp: Unix epoch seconds from the message (used to infer occasion date when AI can't).
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

    # Step 1: 1:1 chat — resolve contact directly by phone from JID
    direct_contact = None
    if not chat_id.endswith("@g.us") and not chat_id.endswith("@broadcast"):
        direct_contact = resolve_contact_by_phone(chat_id, contacts)
        if direct_contact:
            logger.debug("1:1 chat: resolved contact %s from JID %s", direct_contact.name, chat_id)

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

    # Step 1 override: trust the direct phone resolution over AI guess
    if direct_contact:
        matched_contact_id = direct_contact.id
        matched_contact = direct_contact
    else:
        # Step 2: use AI-suggested contact id (validated against actual contacts)
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
        match_score=None,
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


async def scan_group_chat_for_occasions(
    chat_id: str, messages: list, db
) -> int:
    """
    Process historical group chat messages as daily context windows.
    Returns the number of new detections created.

    Strategy:
    - Group messages into UTC-day buckets
    - For each day that contains occasion keywords, run AI context-window analysis
    - Use thank-you pattern to identify recipient; fall back to AI contact matching
    - Minor-proxy pattern (parent thanking on behalf of child) causes the window to be skipped
    """
    from app.models.contact import Contact
    from app.models.detected_occasion import DetectedOccasion
    from collections import defaultdict
    from datetime import date as date_type

    if not messages:
        return 0

    contacts = db.query(Contact).all()

    # Group messages by UTC date
    days: dict[str, list] = defaultdict(list)
    for msg in messages:
        ts = msg.get("timestamp")
        if ts:
            day = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
        else:
            day = "unknown"
        days[day].append(msg)

    new_detections = 0
    for day_str, day_msgs in sorted(days.items()):
        # Pre-filter: any occasion keyword in this day's messages?
        day_text = " ".join(m["body"] for m in day_msgs)
        if not is_likely_occasion_message(day_text):
            continue

        # Use a synthetic ID for the day-window to deduplicate
        synthetic_id = f"window:{chat_id}:{day_str}"
        if db.query(DetectedOccasion).filter(DetectedOccasion.message_id == synthetic_id).first():
            continue

        result = await analyze_group_context_window(day_msgs, contacts, db)
        if not result:
            continue

        detected_name = result.get("name", "").strip()
        occasion_type = result.get("occasion_type", "custom")
        occasion_label = result.get("occasion_label")
        detected_month = result.get("month")
        detected_day = result.get("day")
        detected_year = result.get("year")
        confidence = result.get("confidence", "medium")
        thanked_by_jid = result.get("thanked_by_jid")

        # Resolve matched_contact_id: AI match first, then JID of who said thanks
        matched_contact_id = _validate_contact_id(result.get("matched_contact_id"), contacts)
        if not matched_contact_id and thanked_by_jid:
            thank_contact = resolve_contact_by_jid(thanked_by_jid, contacts)
            if thank_contact:
                matched_contact_id = thank_contact.id
                logger.debug(
                    "Group context: resolved contact %s via thank-you JID %s",
                    thank_contact.name, thanked_by_jid,
                )

        # Date fallback: use the window day itself
        if (detected_month is None or detected_day is None) and day_str != "unknown":
            d = date_type.fromisoformat(day_str)
            detected_month = detected_month or d.month
            detected_day = detected_day or d.day

        if is_duplicate_detection(synthetic_id, matched_contact_id, occasion_type, detected_month, detected_day, db):
            continue

        matched_contact = next((c for c in contacts if c.id == matched_contact_id), None)

        detection = DetectedOccasion(
            message_id=synthetic_id,
            source_chat_id=chat_id,
            raw_message="\n".join(m["body"] for m in day_msgs)[:2000],
            detected_name=detected_name,
            occasion_type=occasion_type,
            occasion_label=occasion_label,
            detected_month=detected_month,
            detected_day=detected_day,
            detected_year=detected_year,
            confidence=confidence,
            matched_contact_id=matched_contact_id,
            match_score=None,
            status="pending",
        )
        db.add(detection)
        db.commit()
        new_detections += 1
        logger.info(
            "Group context detected %s for '%s' (confidence=%s, contact=%s, thanks_from=%s) in %s on %s",
            occasion_type, detected_name, confidence,
            matched_contact.name if matched_contact else "none",
            thanked_by_jid or "none",
            chat_id, day_str,
        )

    return new_detections
