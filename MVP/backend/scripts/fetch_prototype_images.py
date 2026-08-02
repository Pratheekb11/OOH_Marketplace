"""Downloads every URL in scripts/image_manifest.json into MVP/frontend/public/images/.

Run as:

    cd MVP/backend
    source .venv/bin/activate
    python -m scripts.fetch_prototype_images [--force]

The manifest entries point at ephemeral `lh3.googleusercontent.com/aida-public/*`
Google Stitch preview URLs captured from the static prototype
(Ui_Prototype_MVP_Prep/*.html). Those URLs can rot at any time, so:

- the script is idempotent: an existing destination file is left alone unless
  --force is passed;
- a single failed download is logged and skipped rather than aborting the run;
- the process exits 1 if *any* file failed, so CI/manual runs notice rot, but
  everything that *could* be fetched still lands on disk.

Only stdlib (urllib.request) is used -- no new dependency in requirements.txt.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

MANIFEST_PATH = Path(__file__).resolve().parent / "image_manifest.json"
IMAGES_ROOT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "images"
TIMEOUT_SECONDS = 30
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def load_manifest() -> list[dict]:
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        return json.load(f)


def download_one(entry: dict, force: bool) -> str:
    """Returns one of "downloaded", "skipped", "failed"."""
    dest = IMAGES_ROOT / entry["dest"]
    if dest.exists() and not force:
        print(f"SKIP     {entry['dest']} (already exists)")
        return "skipped"

    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(entry["url"], headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            data = response.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
        print(f"FAILED   {entry['dest']} <- {entry['url']} ({exc})")
        return "failed"

    dest.write_bytes(data)
    print(f"OK       {entry['dest']} ({len(data)} bytes)")
    return "downloaded"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Re-download even if the destination file already exists.")
    args = parser.parse_args()

    manifest = load_manifest()
    counts = {"downloaded": 0, "skipped": 0, "failed": 0}
    for entry in manifest:
        counts[download_one(entry, args.force)] += 1

    print(f"\n{counts['downloaded']} downloaded, {counts['skipped']} skipped, {counts['failed']} failed")
    return 1 if counts["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
