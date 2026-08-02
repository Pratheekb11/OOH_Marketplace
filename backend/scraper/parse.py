"""Text heuristics shared by every adapter.

OOH sites publish the same facts in wildly different prose, so each extractor
here takes a blob of page text and returns a best-effort value plus, where the
reading is ambiguous, a warning the operator can review before import.
"""
from __future__ import annotations

import re

FEET_PER_METRE = 3.28084
# Indian OOH inventory is quoted in feet; sizes outside this range are almost
# always a phone number, a pincode or a price that slipped past the regex.
MIN_DIM_FT = 1.0
MAX_DIM_FT = 300.0

_NUM = r"\d{1,4}(?:\.\d{1,2})?"
_FT_UNIT = r"ft\.?|feet|foot|'|’"
_M_UNIT = r"m\.?|mtr\.?|meters?|metres?"
_UNIT = rf"(?:{_FT_UNIT}|{_M_UNIT})"

DIMENSION_RE = re.compile(
    rf"(?P<w>{_NUM})\s*(?P<wu>{_UNIT})?\s*(?:[x×*]|by)\s*(?P<h>{_NUM})\s*(?P<hu>{_UNIT})?",
    re.IGNORECASE,
)
# "Width: 40 ft ... Height: 20 ft" written as separate labelled fields.
# The labels need word boundaries: without them the trailing "h" of "Width"
# matches the height label and both values read as the width.
LABELLED_W_RE = re.compile(rf"\b(?:width|w)\b\s*[:\-]?\s*(?P<v>{_NUM})\s*(?P<u>{_UNIT})?", re.IGNORECASE)
LABELLED_H_RE = re.compile(rf"\b(?:height|ht|h)\b\s*[:\-]?\s*(?P<v>{_NUM})\s*(?P<u>{_UNIT})?", re.IGNORECASE)

PRICE_RE = re.compile(
    r"(?:₹|rs\.?|inr)\s*(?P<amt>\d[\d,]*(?:\.\d{1,2})?)\s*"
    r"(?P<scale>lakhs?|lacs?|crores?|k\b)?\s*"
    r"(?:(?:/|per|p\.?)\s*(?P<period>day|days|week|month|months|mo\b|fortnight|quarter|year|annum))?",
    re.IGNORECASE,
)
FOOTFALL_RE = re.compile(
    r"(?:footfalls?|foot\s*fall|traffic\s*count|daily\s*(?:traffic|views|reach)|impressions|eyeballs)"
    r"[^\d\n]{0,25}(?P<amt>\d[\d,]*(?:\.\d+)?)\s*(?P<scale>lakhs?|lacs?|crores?|k\b|million|mn\b)?",
    re.IGNORECASE,
)
PINCODE_RE = re.compile(r"\b(?P<pin>[1-9]\d{5})\b")
LATLNG_RE = re.compile(r"(?P<lat>-?\d{1,2}\.\d{4,})\s*,\s*(?P<lng>-?\d{1,3}\.\d{4,})")

SCALE_FACTORS = {
    "k": 1_000, "lakh": 100_000, "lakhs": 100_000, "lac": 100_000, "lacs": 100_000,
    "crore": 10_000_000, "crores": 10_000_000, "million": 1_000_000, "mn": 1_000_000,
}
PERIOD_DAYS = {
    "day": 1, "days": 1, "week": 7, "fortnight": 15, "month": 30, "months": 30,
    "mo": 30, "quarter": 91, "year": 365, "annum": 365,
}

# Longest phrases first so "bus shelter" wins over a bare "bus".
SPACE_TYPE_KEYWORDS = [
    ("bus queue shelter", "bus_shelter"), ("bus shelter", "bus_shelter"),
    ("foot overbridge", "foot_overbridge"), ("fob", "foot_overbridge"),
    ("digital screen", "digital"), ("led screen", "digital"), ("digital", "digital"), ("led", "digital"),
    ("unipole", "unipole"), ("uni pole", "unipole"), ("gantry", "gantry"),
    ("pole kiosk", "pole_kiosk"), ("kiosk", "kiosk"),
    ("wall wrap", "wall_wrap"), ("wall painting", "wall_wrap"),
    ("mall", "mall"), ("airport", "airport"), ("metro", "metro"),
    ("traffic booth", "traffic_booth"), ("billboard", "hoarding"), ("hoarding", "hoarding"),
]
ILLUMINATION_KEYWORDS = [
    ("front lit", "front_lit"), ("frontlit", "front_lit"),
    ("back lit", "back_lit"), ("backlit", "back_lit"),
    ("non lit", "non_lit"), ("non-lit", "non_lit"), ("nonlit", "non_lit"),
    ("unlit", "non_lit"), ("illuminated", "lit"), ("lit", "lit"),
]

INDIAN_CITIES = [
    "mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "hyderabad", "chennai",
    "kolkata", "pune", "ahmedabad", "surat", "jaipur", "lucknow", "kanpur", "nagpur",
    "indore", "thane", "bhopal", "visakhapatnam", "patna", "vadodara", "ghaziabad",
    "ludhiana", "agra", "nashik", "faridabad", "meerut", "rajkot", "varanasi",
    "srinagar", "aurangabad", "dhanbad", "amritsar", "navi mumbai", "allahabad",
    "prayagraj", "ranchi", "howrah", "coimbatore", "jabalpur", "gwalior", "vijayawada",
    "jodhpur", "madurai", "raipur", "kota", "chandigarh", "guwahati", "solapur",
    "mysuru", "mysore", "gurugram", "gurgaon", "noida", "kochi", "cochin",
    "thiruvananthapuram", "bhubaneswar", "dehradun", "goa", "panaji",
]


def _to_float(raw: str) -> float:
    return float(raw.replace(",", ""))


def _scaled(amount: float, scale: str | None) -> float:
    if not scale:
        return amount
    return amount * SCALE_FACTORS.get(scale.lower().strip().rstrip("."), 1)


def _is_metric(unit: str | None) -> bool:
    return bool(unit) and re.fullmatch(_M_UNIT, unit.strip(), re.IGNORECASE) is not None


def parse_dimensions(text: str) -> tuple[float | None, float | None, str | None, list[str]]:
    """Return (width_ft, height_ft, matched_text, warnings).

    Assumes the conventional width-x-height ordering and, when no unit is
    printed, feet - flagging the assumption so it can be reviewed.
    """
    warnings: list[str] = []
    if not text:
        return None, None, None, warnings

    for match in DIMENSION_RE.finditer(text):
        width, height = _to_float(match.group("w")), _to_float(match.group("h"))
        width_unit, height_unit = match.group("wu"), match.group("hu")
        unit = height_unit or width_unit

        if _is_metric(unit):
            width, height = width * FEET_PER_METRE, height * FEET_PER_METRE
        elif unit is None:
            warnings.append(f"no unit on size '{match.group(0).strip()}'; assumed feet")

        if not (MIN_DIM_FT <= width <= MAX_DIM_FT and MIN_DIM_FT <= height <= MAX_DIM_FT):
            warnings.append(f"discarded implausible size '{match.group(0).strip()}'")
            continue
        return round(width, 2), round(height, 2), match.group(0).strip(), warnings

    width_match, height_match = LABELLED_W_RE.search(text), LABELLED_H_RE.search(text)
    if width_match and height_match:
        width, height = _to_float(width_match.group("v")), _to_float(height_match.group("v"))
        if _is_metric(width_match.group("u")):
            width *= FEET_PER_METRE
        if _is_metric(height_match.group("u")):
            height *= FEET_PER_METRE
        if MIN_DIM_FT <= width <= MAX_DIM_FT and MIN_DIM_FT <= height <= MAX_DIM_FT:
            raw = f"{width_match.group(0).strip()} / {height_match.group(0).strip()}"
            return round(width, 2), round(height, 2), raw, warnings

    return None, None, None, warnings


def parse_price(text: str) -> tuple[float | None, str | None, str | None, list[str]]:
    """Return (price_per_day, matched_text, period, warnings).

    Sources quote monthly rates far more often than daily ones, so the period
    is normalised to a per-day figure using `PERIOD_DAYS`.
    """
    warnings: list[str] = []
    if not text:
        return None, None, None, warnings

    match = PRICE_RE.search(text)
    if not match:
        return None, None, None, warnings

    amount = _scaled(_to_float(match.group("amt")), match.group("scale"))
    period = (match.group("period") or "").lower().strip().rstrip(".")
    if not period:
        period = "month"
        warnings.append(f"no rate period on '{match.group(0).strip()}'; assumed per month")

    days = PERIOD_DAYS.get(period, 30)
    per_day = amount / days
    if per_day <= 0:
        return None, match.group(0).strip(), period, warnings
    return round(per_day, 2), match.group(0).strip(), period, warnings


def parse_footfall(text: str) -> int | None:
    if not text:
        return None
    match = FOOTFALL_RE.search(text)
    if not match:
        return None
    value = _scaled(_to_float(match.group("amt")), match.group("scale"))
    return int(value) if value > 0 else None


def _first_keyword(text: str, table: list[tuple[str, str]]) -> str | None:
    lowered = (text or "").lower()
    for phrase, value in table:
        if re.search(rf"\b{re.escape(phrase)}\b", lowered):
            return value
    return None


def parse_space_type(text: str, default: str = "hoarding") -> str:
    return _first_keyword(text, SPACE_TYPE_KEYWORDS) or default


def parse_illumination(text: str) -> str | None:
    return _first_keyword(text, ILLUMINATION_KEYWORDS)


def parse_city(text: str) -> str | None:
    lowered = (text or "").lower()
    hits = [city for city in INDIAN_CITIES if re.search(rf"\b{re.escape(city)}\b", lowered)]
    if not hits:
        return None
    return max(hits, key=len).title()


def parse_pincode(text: str) -> str | None:
    match = PINCODE_RE.search(text or "")
    return match.group("pin") if match else None


def parse_latlng(text: str) -> tuple[float | None, float | None]:
    match = LATLNG_RE.search(text or "")
    if not match:
        return None, None
    lat, lng = float(match.group("lat")), float(match.group("lng"))
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return lat, lng
    return None, None


def clean_text(value: str | None) -> str:
    """Collapse the whitespace that survives HTML-to-text conversion."""
    return re.sub(r"\s+", " ", value or "").strip()
