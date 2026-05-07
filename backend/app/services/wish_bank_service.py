"""
Offline Wish Bank service.

Reads wishes.txt, picks a random template matching the occasion type,
and substitutes contact variables. No network required.

Template format (in wishes.txt):
    [birthday]
    Happy Birthday {name}! ...

    [anniversary]
    Happy Anniversary {name} and {partner_name}! ...

    [custom]
    Warmest wishes, {name}! ...

Supported variables:
    {name}            — display name (alias if use_alias, else contact.name)
    {partner_name}    — partner name (anniversary only; omitted if blank)
    {relationship}    — contact.relationship
    {occasion_label}  — human-readable occasion label (e.g. "Birthday")
"""

import logging
import os
import random
import re
from datetime import date
from pathlib import Path

from app.models.contact import Contact
from app.models.occasion import Occasion

logger = logging.getLogger(__name__)

# Default path: wishes.txt lives next to the backend package
_DEFAULT_PATH = Path(__file__).parent.parent.parent / "wishes.txt"

# Matches lines like [birthday], [anniversary], [custom]
_TAG_RE = re.compile(r"^\[([a-z_]+)\]\s*$", re.IGNORECASE)


def _load_templates(path: Path | None = None) -> dict[str, list[str]]:
    """Parse the wish bank file and return a dict of occasion_type → [templates]."""
    target = path or _DEFAULT_PATH
    if not target.exists():
        logger.warning("Wish bank file not found: %s", target)
        return {}

    templates: dict[str, list[str]] = {}
    current_tag: str | None = None
    current_lines: list[str] = []

    def _flush():
        if current_tag and current_lines:
            text = "\n".join(current_lines).strip()
            if text:
                templates.setdefault(current_tag, []).append(text)

    with target.open(encoding="utf-8") as fh:
        for raw in fh:
            line = raw.rstrip("\n")
            # Skip comment lines
            if line.lstrip().startswith("#"):
                continue
            tag_match = _TAG_RE.match(line.strip())
            if tag_match:
                _flush()
                current_tag = tag_match.group(1).lower()
                current_lines = []
            else:
                if current_tag is not None:
                    current_lines.append(line)

    _flush()
    return templates


def _substitute(template: str, contact: Contact, occasion: Occasion, on_date: date) -> str:
    """Replace all {variable} placeholders in the template."""
    display_name = contact.alias if (contact.alias and contact.use_alias) else contact.name
    partner = contact.partner_name or ""

    # For anniversary templates that still include {partner_name} when not set,
    # fall back to a graceful phrase so the message stays natural.
    if not partner and "{partner_name}" in template:
        template = template.replace(" and {partner_name}", "").replace("{partner_name} and ", "").replace("{partner_name}", "your partner")

    if occasion.type == "birthday":
        occ_label = "Birthday"
    elif occasion.type == "anniversary":
        occ_label = "Anniversary"
    else:
        occ_label = occasion.label or "Special Occasion"

    replacements = {
        "{name}": display_name,
        "{partner_name}": partner,
        "{relationship}": contact.relationship or "friend",
        "{occasion_label}": occ_label,
    }
    for placeholder, value in replacements.items():
        template = template.replace(placeholder, value)

    return template.strip()


def pick_wish(
    contact: Contact,
    occasion: Occasion,
    on_date: date,
    bank_path: Path | None = None,
) -> str:
    """Pick and render a random wish for the given contact and occasion.

    Falls back gracefully through: exact type → 'custom' → hardcoded default.
    """
    templates = _load_templates(bank_path)
    occ_type = occasion.type.lower()  # "birthday" | "anniversary" | "custom"

    # Try exact match first, then fall back to "custom", then hardcoded default
    candidates = templates.get(occ_type) or templates.get("custom") or []

    if not candidates:
        logger.warning("Wish bank is empty or missing — using hardcoded default")
        display_name = contact.alias if (contact.alias and contact.use_alias) else contact.name
        return f"Warm wishes to you on this special day, {display_name}! 🎉 Hope it's wonderful!"

    template = random.choice(candidates)
    return _substitute(template, contact, occasion, on_date)


def pick_wish_by_type(
    occasion_type: str,
    name: str,
    partner_name: str = "",
    relationship: str = "",
    occasion_label: str = "",
    bank_path: Path | None = None,
) -> str:
    """Pick a wish using raw values (no DB models) — useful for broadcast messages."""
    templates = _load_templates(bank_path)
    occ_type = occasion_type.lower()
    candidates = templates.get(occ_type) or templates.get("custom") or []

    if not candidates:
        return f"Warm wishes to you on this special day, {name}! 🎉"

    template = random.choice(candidates)
    if not partner_name and "{partner_name}" in template:
        template = template.replace(" and {partner_name}", "").replace("{partner_name} and ", "").replace("{partner_name}", "your partner")

    occ_label = occasion_label or occ_type.capitalize()
    template = template.replace("{name}", name)
    template = template.replace("{partner_name}", partner_name)
    template = template.replace("{relationship}", relationship or "friend")
    template = template.replace("{occasion_label}", occ_label)
    return template.strip()


def list_templates(bank_path: Path | None = None) -> dict[str, list[str]]:
    """Return the full parsed template dict (for admin/debug use)."""
    return _load_templates(bank_path)
