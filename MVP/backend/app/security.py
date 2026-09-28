"""Auth primitives factored out of app.main so scripts (e.g. scripts/seed.py) can
import password_context without constructing the whole FastAPI app as an import
side effect.
"""
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Role, User
from app.ratelimit import limiter  # noqa: F401  - re-exported for app.main and the tests

settings = get_settings()
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()


def credential_stamp(user: User) -> str:
    """A fingerprint of the account's current credential, carried in every token.

    JWTs are stateless, so this is what lets a token die early: changing the
    password, or Google taking over an account and dropping its password,
    changes the stamp and every token issued before it stops matching.
    """
    return hmac.new(settings.secret_key.encode(), (user.password_hash or "").encode(), hashlib.sha256).hexdigest()[:32]


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "cs": credential_stamp(user),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=["HS256"])
        user_id = int(payload["sub"])
        stamp = str(payload["cs"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not hmac.compare_digest(stamp, credential_stamp(user)):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    return user


def require_roles(*roles: Role):
    """Guard a route on a set of roles, with admin as a superset of all of them.

    An admin passes every role gate so a single account can work both halves of
    the product -- the owner surfaces (/owner/*, listing submission) and the
    advertiser surfaces (cart, checkout, /bookings). The endpoints themselves
    still scope their queries by the caller's own id, so an admin sees its own
    listings, cart and bookings rather than everybody's; this widens *access*,
    never the blast radius of a single query.
    """
    def checker(user: User = Depends(current_user)) -> User:
        if user.role is not Role.admin and user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker
