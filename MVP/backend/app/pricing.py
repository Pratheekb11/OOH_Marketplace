"""Pricing helpers shared by cart/checkout routes (added in later waves) and tests.

All money figures are rounded to 2dp at each step, matching the reference backend.
"""
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
