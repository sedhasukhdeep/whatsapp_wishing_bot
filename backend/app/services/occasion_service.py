from datetime import date

from app.models.occasion import Occasion


def compute_age(occasion: Occasion, on_date: date) -> int | None:
    if occasion.type == "birthday" and occasion.year:
        return on_date.year - occasion.year
    return None


def compute_years(occasion: Occasion, on_date: date) -> int | None:
    if occasion.type == "anniversary" and occasion.year:
        return on_date.year - occasion.year
    return None


def build_occasion_display(occasion: Occasion, on_date: date) -> str:
    if occasion.type == "birthday":
        age = compute_age(occasion, on_date)
        return f"Birthday (turning {age})" if age else "Birthday"
    if occasion.type == "anniversary":
        years = compute_years(occasion, on_date)
        return f"Wedding Anniversary ({years} years)" if years else "Anniversary"
    return occasion.label or "Special Occasion"
