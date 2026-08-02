"""Normalized records produced by the hoarding scrapers.

Field names mirror `app.models.Listing` wherever a mapping exists so the
importer can move records into the marketplace without a translation table.
Anything the source publishes that we have no column for lands in `extra`.
"""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field

# ListingCreate requires these to be present and positive/non-empty.
REQUIRED_FOR_IMPORT = ("title", "location", "width_ft", "height_ft", "price_per_day")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ScrapedImage(BaseModel):
    """One creative/site photo harvested from a source page."""

    url: str
    #: Set when the adapter knows this field *is* the site photo. Skips the
    #: filename heuristics, which reject anything containing "logo" - fine for
    #: a generic crawl, wrong for sources that name their photos `*_logo.jpg`.
    trusted: bool = False
    local_path: str | None = None
    sha256: str | None = None
    byte_size: int | None = None
    width_px: int | None = None
    height_px: int | None = None
    alt: str = ""


class ScrapedHoarding(BaseModel):
    """A single ad hoarding as published by an external site."""

    source_url: str
    source_site: str = ""
    source_id: str | None = None
    scraped_at: datetime = Field(default_factory=_utcnow)

    title: str = ""
    space_type: str = "hoarding"
    description: str = ""

    location: str = ""
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    width_ft: float | None = None
    height_ft: float | None = None
    size_raw: str | None = None

    price_per_day: float | None = None
    price_raw: str | None = None
    price_period: str | None = None

    footfall_estimate: int | None = None
    illumination: str | None = None
    availability: str | None = None

    images: list[ScrapedImage] = Field(default_factory=list)
    extra: dict = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)

    @property
    def area_sqft(self) -> float | None:
        if self.width_ft and self.height_ft:
            return round(self.width_ft * self.height_ft, 2)
        return None

    def missing_for_import(self) -> list[str]:
        """Fields the marketplace needs that this record does not yet carry."""
        missing = []
        for field in REQUIRED_FOR_IMPORT:
            value = getattr(self, field)
            if value is None or (isinstance(value, str) and not value.strip()):
                missing.append(field)
            elif isinstance(value, (int, float)) and value <= 0:
                missing.append(field)
        return missing

    def is_importable(self) -> bool:
        return not self.missing_for_import()

    def flat_row(self) -> dict:
        """One-line-per-hoarding view used for the CSV export."""
        row = self.model_dump(mode="json", exclude={"images", "extra", "warnings"})
        row["area_sqft"] = self.area_sqft
        row["image_count"] = len(self.images)
        row["image_urls"] = " | ".join(image.url for image in self.images)
        row["local_images"] = " | ".join(i.local_path for i in self.images if i.local_path)
        row["warnings"] = " | ".join(self.warnings)
        row["importable"] = self.is_importable()
        return row
