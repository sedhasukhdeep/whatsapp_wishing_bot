"""
Parse .ics calendar files to extract birthday and anniversary events.
Supports Google Calendar, Apple Calendar, and generic iCalendar exports.
"""

import re

from icalendar import Calendar

from app.schemas.calendar_import import CalendarImportPreviewItem


def parse_ics_preview(data: bytes) -> list[CalendarImportPreviewItem]:
    """Parse ICS bytes and return detected occasion events."""
    cal = Calendar.from_ical(data)
    results = []

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        summary = str(component.get("SUMMARY", "")).strip()
        dtstart = component.get("DTSTART")
        if not dtstart or not summary:
            continue

        dt = dtstart.dt
        # Skip datetimes (VEVENT for meetings); we only want date-based events
        if not hasattr(dt, "month"):
            continue

        month, day = dt.month, dt.day
        # Apple Calendar uses year 1604 as sentinel for "no known birth year"
        year = dt.year if dt.year >= 1900 else None

        # --- Classify by summary text ---

        # Birthday: "Name's Birthday" (Google, Apple, generic)
        m = re.match(r"^(.+?)'s\s+birthday$", summary, re.IGNORECASE)
        if m:
            results.append(CalendarImportPreviewItem(
                raw_summary=summary,
                name=m.group(1).strip(),
                occasion_type="birthday",
                label=None,
                month=month, day=day, year=year,
            ))
            continue

        # Anniversary: "Name's Anniversary" or "John & Jane's Anniversary"
        if re.search(r"\banniversary\b", summary, re.IGNORECASE):
            m2 = re.match(r"^(.+?)'s\s+anniversary$", summary, re.IGNORECASE)
            name = m2.group(1).strip() if m2 else summary
            results.append(CalendarImportPreviewItem(
                raw_summary=summary,
                name=name,
                occasion_type="anniversary",
                label=None,
                month=month, day=day, year=year,
            ))
            continue

        # Generic date-based event → custom occasion
        results.append(CalendarImportPreviewItem(
            raw_summary=summary,
            name=summary,
            occasion_type="custom",
            label=summary,
            month=month, day=day, year=year,
        ))

    return results
