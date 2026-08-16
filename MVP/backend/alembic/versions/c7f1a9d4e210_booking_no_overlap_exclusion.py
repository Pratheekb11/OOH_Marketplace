"""stop two checkouts from double-booking the same space (Postgres)

The overlap check in `checkout()` is check-then-act: it SELECTs for a
conflicting booking, then INSERTs. SQLite serializes writers so nothing can
interleave, but under Postgres at READ COMMITTED two concurrent checkouts for
the same listing and overlapping dates can both pass the SELECT before either
commits, and the space is sold twice.

`SELECT ... FOR UPDATE` on the listing row (added in app/main.py) serializes
those checkouts inside the app. This constraint is the backstop underneath it:
the database itself refuses the second overlapping row, whatever the caller
does -- another process, a script, a future async worker.

Postgres only. SQLite has no EXCLUDE constraint and no GiST, and does not need
one (one writer at a time), so this migration is a no-op there.

Two details that are easy to get wrong:

- The range is `[]` (both ends inclusive), matching the pricing rule that
  bills both the start and the end date.
- The predicate lists enum *names*, not values. `Enum(BookingStatus,
  native_enum=False)` persists the member name, so the column holds
  'pending' / 'booked' / 'active' / 'cancelled' -- not 'pending_payment'.
  A cancelled booking must not block a re-sale of those dates.
"""
revision = 'c7f1a9d4e210'
down_revision = 'a4d9c1b2f883'
branch_labels = None
depends_on = None

from alembic import op

CONSTRAINT_NAME = "bookings_no_overlap_per_listing"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute(
        f"""
        ALTER TABLE bookings ADD CONSTRAINT {CONSTRAINT_NAME}
        EXCLUDE USING gist (
            listing_id WITH =,
            daterange(start_date, end_date, '[]') WITH &&
        )
        WHERE (status IN ('pending', 'booked', 'active'))
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute(f"ALTER TABLE bookings DROP CONSTRAINT IF EXISTS {CONSTRAINT_NAME}")
