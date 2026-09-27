"""Rename imported listing photos from `scraped-<source_id>.<ext>` to their
opaque names (see app/images.py). One-off, and safe to re-run: files that are
already renamed are left alone.

    python -m scripts.rename_scraped_images                 # frontend/public/images/listings
    python -m scripts.rename_scraped_images --dir some/dir
"""
from __future__ import annotations

import argparse
from pathlib import Path

from app.images import legacy_to_opaque_name


def rename_scraped_images(directory: Path) -> int:
    """Rename every legacy file in `directory`; return how many were renamed."""
    renamed = 0
    for path in sorted(Path(directory).glob("scraped-*")):
        target_name = legacy_to_opaque_name(path.name)
        if target_name is None:
            continue
        target = path.with_name(target_name)
        if target.exists():
            # Re-imported after a partial run: the opaque copy is authoritative.
            path.unlink()
        else:
            path.rename(target)
        renamed += 1
    return renamed


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Give scraped listing photos opaque file names")
    parser.add_argument("--dir", default="../frontend/public/images/listings")
    args = parser.parse_args(argv)
    directory = Path(args.dir).resolve()
    count = rename_scraped_images(directory)
    print(f"Renamed {count} files in {directory}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
