"""Public names for imported listing photos.

The importer used to save each photo as `scraped-<source_id>.<ext>`, which
put the source site's own listing id in every image URL. Photos are now named
by a hash of that id instead: stable across re-imports and databases (the
same source id always gives the same name), but not the id itself.

Rows imported before the rename still store the old URL, including in the
hosted database. `public_image_url` maps those to the new name on the way
out, so no data migration is needed; `scripts/rename_scraped_images.py`
renames the files on disk to match.
"""
from __future__ import annotations

import hashlib
import re

_LEGACY = re.compile(r"^(?P<dir>.*/)?scraped-(?P<source_id>[^/]+?)(?P<ext>\.[A-Za-z0-9]+)$")


def image_file_name(source_id: str, ext: str) -> str:
    """Opaque file name for a scraped photo, e.g. `3f2a…c9.jpg`."""
    digest = hashlib.sha256(f"adspace-listing-image:{source_id}".encode()).hexdigest()[:20]
    return f"{digest}{ext.lower()}"


def legacy_to_opaque_name(name: str) -> str | None:
    """`scraped-<id>.<ext>` -> opaque name; None for any other file name."""
    match = _LEGACY.match(name)
    if not match or match.group("dir"):
        return None
    return image_file_name(match.group("source_id"), match.group("ext"))


def public_image_url(url: str | None) -> str | None:
    """Rewrite a legacy `/…/scraped-<id>.<ext>` URL; return anything else unchanged."""
    if not url:
        return url
    match = _LEGACY.match(url)
    if not match:
        return url
    return f"{match.group('dir') or ''}{image_file_name(match.group('source_id'), match.group('ext'))}"
