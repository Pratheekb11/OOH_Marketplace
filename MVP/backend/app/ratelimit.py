"""Rate limits that hold across serverless instances.

Vercel runs the API as short-lived functions: each request can land on a
fresh instance, so a counter kept in process memory (what slowapi's default
storage does) resets all the time and never trips. The counters live in the
database instead, one row per key in `rate_limit_buckets`, as a fixed window:
the row's `window_start` says which window `hits` belongs to, and the first
hit of a new window resets it to 1 in the same upsert. Rows are overwritten
in place, so the table grows with distinct callers, not with requests; stale
ones are swept now and then.

Who "the caller" is: on Vercel, the edge proxy overwrites `X-Real-IP` with the
connecting client's address, so it can be trusted there. Anywhere else the
header is whatever the caller typed, so the socket address is used instead.
"""
from __future__ import annotations

import math
import os
import random
import time

from fastapi import HTTPException, Request
from sqlalchemy import case, delete
from sqlalchemy.orm import Session

from app.models import RateLimitBucket

#: Overridable in tests to pin the window.
clock = time.time

#: Rows untouched for this long are removed by the occasional sweep.
_STALE_SECONDS = 24 * 3600
_SWEEP_PROBABILITY = 0.01


def client_ip(request: Request) -> str:
    if os.environ.get("VERCEL"):
        forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "").split(",")[0]
        if forwarded.strip():
            return forwarded.strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    """`enabled` is switched off by the test suite, which exercises routes far
    faster than any limit allows; tests of the limits switch it back on."""

    def __init__(self) -> None:
        self.enabled = True

    def hit(self, db: Session, key: str, limit: int, window_seconds: int) -> None:
        """Count one attempt against `key`; 429 once `limit` is exceeded.

        Committed straight away, before the route does its own work, so a
        request that goes on to fail (a wrong password) still counts.
        """
        if not self.enabled:
            return
        now = clock()
        window_start = int(now // window_seconds) * window_seconds
        hits = _increment(db, key[:255], window_start)
        if random.random() < _SWEEP_PROBABILITY:
            db.execute(delete(RateLimitBucket).where(RateLimitBucket.window_start < int(now) - _STALE_SECONDS))
        db.commit()
        if hits > limit:
            retry_after = max(1, math.ceil(window_start + window_seconds - now))
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )


def _increment(db: Session, key: str, window_start: int) -> int:
    """Atomic upsert: +1 within the current window, reset to 1 in a new one."""
    if db.get_bind().dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    table = RateLimitBucket.__table__
    statement = insert(table).values(key=key, window_start=window_start, hits=1)
    same_window = table.c.window_start == statement.excluded.window_start
    statement = statement.on_conflict_do_update(
        index_elements=[table.c.key],
        set_={
            "hits": case((same_window, table.c.hits + 1), else_=1),
            "window_start": statement.excluded.window_start,
        },
    ).returning(table.c.hits)
    return int(db.execute(statement).scalar_one())


limiter = RateLimiter()
