"""Auth primitives factored out of app.main so scripts (e.g. scripts/seed.py) can
import password_context without constructing the whole FastAPI app as an import
side effect.
"""
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings
from app.database import get_db
from app.models import Role, User

settings = get_settings()
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()
limiter = Limiter(key_func=get_remote_address)


def create_token(user: User) -> str:
    payload = {"sub": str(user.id), "role": user.role.value, "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=["HS256"])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: Role):
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker
