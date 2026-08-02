"""Vercel serverless entrypoint.

Vercel's Python runtime treats every file under `api/` as a function and
serves an exported ASGI `app` directly, so this module only has to make the
`app` package importable and re-export the real application. All routing is
done by `vercel.json`, which sends every path here.

Nothing app-specific belongs in this file: it is deployment glue, and
`uvicorn app.main:app` locally must stay the source of truth.
"""
import sys
from pathlib import Path

# The function's working directory is not guaranteed to be on sys.path, and
# `app` lives next to this `api/` directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402  - import must follow the path fix

__all__ = ["app"]
