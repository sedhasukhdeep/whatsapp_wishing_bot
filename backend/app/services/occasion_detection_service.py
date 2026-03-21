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

import asyncio
import json
import logging
import re
import threading
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Prevents concurrent AI calls — local LLMs handle one request at a time.
# threading.Lock instead of asyncio.Semaphore so it works across the scan
# thread (own event loop) and the FastAPI event loop without either
# sneaking past the other's lock.
_ai_lock = threading.Lock()

# Prevents the same message_id being processed twice concurrently
# (e.g. if the bridge fires both 'message' and 'message_create' for the same msg)
_in_progress_ids: set[str] = set()

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


_BIRTHDAY_KW = re.compile(r"\b(birthday|bday|b-day|born|geburtstag|complean|cumple)\b", re.IGNORECASE)
_ANNIVERSARY_KW = re.compile(r"\b(anniversary|anni|anniversaire)\b", re.IGNORECASE)


def _infer_occasion_type(text: str) -> str:
    """Keyword-based occasion type — used for 1:1 chats where AI is not needed."""
    if _BIRTHDAY_KW.search(text):
        return "birthday"
    if _ANNIVERSARY_KW.search(text):
        return "anniversary"
    return "custom"


def _parse_detection_response(raw: str) -> dict | None:
    """Strip thinking tags and parse JSON from the AI response."""
    # Strip complete <think>...</think> blocks
    cleaned = _THINKING_TAG_RE.sub("", raw).strip()
    # Strip truncated/unclosed <think> block (model cut off mid-reasoning)
    cleaned = re.sub(r"<think(?:ing)?>.*$", "", cleaned, flags=re.DOTALL | re.IGNORECASE).strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.DOTALL).strip()
    # Try extracting a JSON object even if there's surrounding text
    json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Occasion detection: failed to parse AI response: %r", cleaned[:200])
        return None


def _build_contacts_context(contacts: list, max_chars: int = 5000) -> str:
    """
    Format contacts list for the AI prompt, capped at max_chars to stay within
    the 4000-token budget. Truncated contacts are noted so the AI knows the list
    may be incomplete.
    """
    if not contacts:
        return "No contacts available."
    lines = ["Contacts:"]
    used = len("Contacts:\n")
    skipped = 0
    for c in contacts:
        parts = [f"- ID {c.id}: {c.name} ({c.relationship})"]
        if c.alias:
            parts.append(f"alias: {c.alias}")
        if c.notes:
            parts.append(f"notes: {c.notes[:60]}")
        line = " | ".join(parts)
        if used + len(line) + 1 > max_chars:
            skipped += 1
        else:
            lines.append(line)
            used += len(line) + 1
    if skipped:
        lines.append(f"({skipped} more contacts omitted to fit token limit)")
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
    Handles both @c.us (1:1 chat) and @s.whatsapp.net (group message sender) JIDs.
    """
    if not jid:
        return None
    # Try whatsapp_chat_id exact match
    for contact in contacts:
        if contact.whatsapp_chat_id and contact.whatsapp_chat_id == jid:
            return contact
    # Fallback: phone digit match for both @c.us and @s.whatsapp.net JIDs
    # Group message authors arrive as @s.whatsapp.net but contacts store @c.us
    if "@c.us" in jid or "@s.whatsapp.net" in jid:
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

    logger.info("Detection user prompt:\n%s", user_message)

    try:
        await asyncio.get_running_loop().run_in_executor(None, _ai_lock.acquire)
        try:
            raw = await call_ai_raw(DETECTION_SYSTEM_PROMPT, user_message, db=db, max_tokens=600)
        finally:
            _ai_lock.release()
    except Exception as e:
        logger.warning("Occasion detection: AI call failed (%s) — skipping", e)
        return None

    logger.info("Detection raw AI response: %r", raw[:600])
    result = _parse_detection_response(raw)
    logger.info("Detection parsed result: %s", result)
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

    # Build JID → contact name map for labelling.
    # Group message authors arrive as @s.whatsapp.net, so add both formats.
    jid_to_contact = {}
    for contact in contacts:
        if contact.whatsapp_chat_id:
            jid_to_contact[contact.whatsapp_chat_id] = contact
        if contact.phone:
            phone_digits = re.sub(r"\D", "", contact.phone)
            if len(phone_digits) >= 7:
                jid_to_contact[f"{phone_digits}@c.us"] = contact
                jid_to_contact[f"{phone_digits}@s.whatsapp.net"] = contact

    # Format messages, capped at 6000 chars to stay within token budget
    MAX_MSG_CHARS = 6000
    msg_lines = []
    total_msg_chars = 0
    truncated = 0
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
        line = f"[{label}]: {m['body']}"
        if total_msg_chars + len(line) + 1 > MAX_MSG_CHARS:
            truncated += 1
        else:
            msg_lines.append(line)
            total_msg_chars += len(line) + 1
    if truncated:
        msg_lines.append(f"({truncated} more messages omitted)")

    window_date = ""
    if messages[0].get("timestamp"):
        dt = datetime.fromtimestamp(messages[0]["timestamp"], tz=timezone.utc)
        window_date = f" ({dt.strftime('%Y-%m-%d')})"

    contacts_context = _build_contacts_context(contacts, max_chars=3000)
    user_message = (
        f"{contacts_context}\n\n"
        f"Group messages{window_date}:\n"
        + "\n".join(msg_lines)
    )

    try:
        await asyncio.get_running_loop().run_in_executor(None, _ai_lock.acquire)
        try:
            raw = await call_ai_raw(GROUP_CONTEXT_SYSTEM_PROMPT, user_message, db=db, max_tokens=600)
        finally:
            _ai_lock.release()
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


def _load_detection_settings(db) -> tuple[list[str], list[dict]]:
    """Load (ignore_keywords, occasion_keywords) from AdminSetting table."""
    from app.models.admin_setting import AdminSetting
    import json as _json

    def _get(key: str) -> str | None:
        row = db.query(AdminSetting).filter(AdminSetting.key == key).first()
        return row.value if row else None

    ignore_raw = _get("detection_ignore_keywords")
    occasion_raw = _get("detection_occasion_keywords")
    return (
        _json.loads(ignore_raw) if ignore_raw else [],
        _json.loads(occasion_raw) if occasion_raw else [],
    )


async def process_message_for_occasion(
    chat_id: str,
    message_id: str,
    body: str,
    db,
    timestamp: int | None = None,
    chat_name: str | None = None,
    sender_jid: str | None = None,
    sender_name: str | None = None,
    profile_id: int | None = None,
) -> None:
    """
    Full detection pipeline: pre-filter → dedupe → load contacts → resolve/detect → persist.

    Step 1 (1:1 chat): If chat_id is @c.us, resolve the contact directly by phone number.
    Step 2 (group chat): AI-driven detection + matching against full contact list.

    chat_name:   display name of the chat/group (from bridge)
    sender_jid:  JID of the message sender (non-null for group messages)
    sender_name: WhatsApp push name of the sender
    timestamp:   Unix epoch seconds (used to infer occasion date when AI can't extract one)
    profile_id:  profile to scope contact loading and detection creation
    """
    from app.models.contact import Contact
    from app.models.detected_occasion import DetectedOccasion

    # Guard against duplicate concurrent processing of the same message_id
    if message_id in _in_progress_ids:
        return
    _in_progress_ids.add(message_id)
    try:
        await _process_message_inner(
            chat_id, message_id, body, db,
            timestamp=timestamp, chat_name=chat_name,
            sender_jid=sender_jid, sender_name=sender_name,
            profile_id=profile_id,
        )
    finally:
        _in_progress_ids.discard(message_id)


async def _process_message_inner(
    chat_id: str,
    message_id: str,
    body: str,
    db,
    timestamp: int | None = None,
    chat_name: str | None = None,
    sender_jid: str | None = None,
    sender_name: str | None = None,
    profile_id: int | None = None,
) -> None:
    from app.models.contact import Contact
    from app.models.detected_occasion import DetectedOccasion

    body_lower = body.lower()

    # Load custom keyword settings
    ignore_keywords, occasion_keywords = _load_detection_settings(db)

    # Check ignore keywords — skip entirely if matched
    if any(kw.lower() in body_lower for kw in ignore_keywords if kw.strip()):
        return

    # Check custom occasion keyword triggers
    forced_occasion: dict | None = None
    for ok in occasion_keywords:
        if ok.get("keyword", "").lower().strip() in body_lower:
            forced_occasion = ok
            break

    # Standard pre-filter — skip if no occasion keywords AND no custom trigger
    if not is_likely_occasion_message(body) and not forced_occasion:
        return

    # Check message_id deduplication before any AI call
    if db.query(DetectedOccasion).filter(DetectedOccasion.message_id == message_id).first():
        return

    # Load contacts scoped to profile if provided
    contacts_q = db.query(Contact)
    if profile_id is not None:
        contacts_q = contacts_q.filter(Contact.profile_id == profile_id)
    contacts = contacts_q.all()

    # Resolve sender display name: contact name > WA push name > phone from JID
    resolved_sender = sender_name
    if sender_jid:
        sender_contact = resolve_contact_by_jid(sender_jid, contacts)
        if sender_contact:
            resolved_sender = sender_contact.name
        elif not resolved_sender:
            phone = re.sub(r"\D", "", sender_jid.split("@")[0])
            resolved_sender = f"+{phone}" if phone else None

    fallback_dt = (
        datetime.fromtimestamp(timestamp, tz=timezone.utc) if timestamp
        else datetime.now(timezone.utc)
    )

    is_group = chat_id.endswith("@g.us") or chat_id.endswith("@broadcast")

    if not is_group:
        # ── Step 1: 1:1 chat — no AI needed ──────────────────────────────────
        # The contact IS whoever we're talking to; resolve by phone from JID.
        direct_contact = resolve_contact_by_phone(chat_id, contacts)
        if not direct_contact:
            logger.debug("1:1 chat: no contact match for JID %s — skipping", chat_id)
            return

        occasion_type = _infer_occasion_type(body)
        occasion_label = None
        detected_name = direct_contact.name
        detected_month = fallback_dt.month
        detected_day = fallback_dt.day
        detected_year = None
        confidence = "high"
        matched_contact_id = direct_contact.id
        matched_contact = direct_contact

        # Custom keyword overrides
        if forced_occasion:
            occasion_type = forced_occasion.get("occasion_type", occasion_type)
            if forced_occasion.get("label"):
                occasion_label = forced_occasion["label"]

        logger.info(
            "1:1 detection (no AI): contact=%s, occasion=%s, date=%s-%s",
            direct_contact.name, occasion_type, detected_month, detected_day,
        )

    else:
        # ── Step 2: Group chat — AI-driven single-message detection ───────────
        result = await detect_occasion_from_message(body, contacts, db)

        if not result and not forced_occasion:
            return

        if result:
            detected_name = result.get("name", "").strip()
            occasion_type = result.get("occasion_type", "custom")
            occasion_label = result.get("occasion_label")
            detected_month = result.get("month")
            detected_day = result.get("day")
            detected_year = result.get("year")
            confidence = result.get("confidence", "medium")
        else:
            detected_name = ""
            occasion_type = "custom"
            occasion_label = None
            detected_month = None
            detected_day = None
            detected_year = None
            confidence = "low"

        # Custom keyword overrides
        if forced_occasion:
            occasion_type = forced_occasion.get("occasion_type", occasion_type)
            if forced_occasion.get("label"):
                occasion_label = forced_occasion["label"]

        # Date fallback: message timestamp
        detected_month = detected_month or fallback_dt.month
        detected_day = detected_day or fallback_dt.day

        matched_contact_id = _validate_contact_id(result.get("matched_contact_id") if result else None, contacts)
        matched_contact = next((c for c in contacts if c.id == matched_contact_id), None)

    if is_duplicate_detection(message_id, matched_contact_id, occasion_type, detected_month, detected_day, db):
        return

    # If profile_id not supplied, derive it from matched contact
    effective_profile_id = profile_id
    if effective_profile_id is None and matched_contact is not None:
        effective_profile_id = getattr(matched_contact, "profile_id", None)

    detection = DetectedOccasion(
        message_id=message_id,
        source_chat_id=chat_id,
        source_chat_name=chat_name,
        sender_jid=sender_jid,
        sender_name=resolved_sender,
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
        profile_id=effective_profile_id,
        status="pending",
    )
    db.add(detection)
    db.commit()
    logger.info(
        "Detected %s for '%s' (confidence=%s, contact_match=%s, sender=%s) in chat %s",
        occasion_type, detected_name, confidence,
        matched_contact.name if matched_contact else "none",
        resolved_sender or "unknown",
        chat_id,
    )


async def scan_group_chat_for_occasions(
    chat_id: str, messages: list, db, chat_name: str | None = None,
    profile_id: int | None = None,
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

    # Apply ignore keywords
    ignore_keywords, occasion_keywords = _load_detection_settings(db)

    contacts_q = db.query(Contact)
    if profile_id is not None:
        contacts_q = contacts_q.filter(Contact.profile_id == profile_id)
    contacts = contacts_q.all()

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

        # Check ignore keywords
        if any(kw.lower() in day_text.lower() for kw in ignore_keywords if kw.strip()):
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

        effective_profile_id = profile_id
        if effective_profile_id is None and matched_contact is not None:
            effective_profile_id = getattr(matched_contact, "profile_id", None)

        detection = DetectedOccasion(
            message_id=synthetic_id,
            source_chat_id=chat_id,
            source_chat_name=chat_name,
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
            profile_id=effective_profile_id,
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
