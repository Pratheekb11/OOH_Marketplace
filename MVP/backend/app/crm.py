"""CRM hand-off for call-back requests.

Not connected yet. Every lead is stored with `crm_status = "pending"`; when a
CRM is chosen, implement `push_lead` to create the contact there and return the
CRM's id for it, and the route marks the row "synced". Anything still
"pending" (a CRM outage, or leads taken before the connection existed) can be
backfilled by querying `leads` on that status.
"""
from app.models import Lead


def push_lead(lead: Lead) -> str | None:
    """Send one lead to the CRM. Returns the CRM's reference, or None when no
    CRM is configured -- the lead then simply waits as "pending"."""
    return None
