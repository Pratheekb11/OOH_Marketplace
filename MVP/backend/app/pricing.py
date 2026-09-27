"""Pricing helpers shared by cart/checkout routes (added in later waves) and tests.

All money figures are rounded to 2dp at each step, matching the reference backend.
"""
import math
from datetime import date

GST_RATE = 0.18

# Flat INR per booking, taken from Ui_Prototype_MVP_Prep/checkout_page.html
ADDON_CATALOG = {
    "printing": {
        "label": "Premium Printing",
        "price": 25000.0,
        "icon": "print",
        "blurb": "High-fidelity vinyl printing with UV-resistant coatings.",
    },
    "installation": {
        "label": "Expert Install",
        "price": 15000.0,
        "icon": "engineering",
        "blurb": "Full crew setup with safety compliance certification.",
    },
    "monitoring": {
        "label": "24/7 Monitoring",
        "price": 8000.0,
        "icon": "verified_user",
        "blurb": "Photo proof of play and immediate technical support.",
    },
}


def _positive_number(value) -> float | None:
    """A usable positive number from a JSON value, or None. Accepts numeric
    strings because the owner wizard stores its form fields as text."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, str):
        try:
            value = float(value.strip())
        except ValueError:
            return None
    if not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        return None
    return float(value)


def min_booking_days(price_per_day: float, extra: dict | None) -> int:
    """Shortest bookable window for a listing, in inclusive days.

    An owner's explicit `extra.min_booking_days` wins. Otherwise a scraped
    row's `extra.minimum_billing` (the source's minimum bill in INR) is turned
    into days at this listing's own day rate, rounded up so the booked amount
    never falls under that bill. Anything unusable means one day.
    """
    extra = extra or {}
    explicit = _positive_number(extra.get("min_booking_days"))
    if explicit is not None:
        return max(1, math.ceil(round(explicit, 6)))
    billing = _positive_number(extra.get("minimum_billing"))
    if billing is not None and price_per_day and price_per_day > 0:
        # round() first: 231000 / 33000 must be 7, not 7.000000000000001 -> 8.
        return max(1, math.ceil(round(billing / price_per_day, 6)))
    return 1


def inclusive_days(start: date, end: date) -> int:
    """Both start and end date are billed, matching the reference backend."""
    return (end - start).days + 1


def addon_lines(codes: list[str]) -> tuple[list[dict], float]:
    """Resolve addon codes against the catalog, ignoring unknown codes.

    Returns ([{code, label, price}], total).
    """
    lines = []
    for code in codes:
        addon = ADDON_CATALOG.get(code)
        if addon is None:
            continue
        lines.append({"code": code, "label": addon["label"], "price": addon["price"]})
    total = round(sum(line["price"] for line in lines), 2)
    return lines, total


def quote_line(listing, start: date, end: date, codes: list[str]) -> dict:
    """Price a single listing booking window, including addons and GST."""
    days = inclusive_days(start, end)
    base = round(days * listing.price_per_day, 2)
    lines, addons_amount = addon_lines(codes)
    gst_amount = round((base + addons_amount) * GST_RATE, 2)
    total = round(base + addons_amount + gst_amount, 2)
    return {
        "days": days,
        "base": base,
        "addons_amount": addons_amount,
        "addon_lines": lines,
        "gst_amount": gst_amount,
        "total": total,
    }


def quote_cart(lines: list[dict]) -> dict:
    """Aggregate a list of quote_line() results (e.g. one per cart item)."""
    subtotal = round(sum(line["base"] for line in lines), 2)
    addons_total = round(sum(line["addons_amount"] for line in lines), 2)
    gst_total = round(sum(line["gst_amount"] for line in lines), 2)
    grand_total = round(sum(line["total"] for line in lines), 2)
    return {
        "subtotal": subtotal,
        "addons_total": addons_total,
        "gst_total": gst_total,
        "grand_total": grand_total,
    }
