from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#: Keys that have appeared in this repo's code, .env.example or docs. Anyone
#: can read them, so a server signing tokens with one can be impersonated.
_PUBLISHED_KEYS = frozenset({
    "change-me-in-production",
    "dev-only-secret-key-change-me-please-32chars",
    "generate-a-long-random-secret-at-least-32-characters",
})
_MIN_SECRET_LENGTH = 32
_MIN_DISTINCT_CHARS = 2  # rejects a key that is one character repeated


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./adspace_mvp.db"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:5500"
    allowed_hosts: str = "localhost,127.0.0.1"
    # OAuth client id for Sign in with Google. Empty disables POST /auth/google.
    google_client_id: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def _production_needs_a_real_secret(self):
        """Refuse to boot production with a guessable SECRET_KEY.

        It signs every bearer token (HS256), so a published or trivial key lets
        anyone mint a token for any account. Failing at startup is loud; a
        warning in a serverless log would go unread.
        """
        if self.app_env.strip().lower() != "production":
            return self
        key = self.secret_key
        if key in _PUBLISHED_KEYS or len(key) < _MIN_SECRET_LENGTH or len(set(key)) < _MIN_DISTINCT_CHARS:
            raise ValueError(
                f"SECRET_KEY is unsafe for production: use a random value of at least "
                f"{_MIN_SECRET_LENGTH} characters (e.g. `openssl rand -hex 32`), never an example from the docs."
            )
        return self

    @property
    def sqlalchemy_url(self) -> str:
        """DATABASE_URL with an explicit driver.

        Hosted Postgres (Neon, Vercel, Render, Heroku) hands out
        `postgresql://` or `postgres://`. SQLAlchemy maps both to psycopg2,
        which is not installed - only psycopg 3 is - so the app would die at
        import with a ModuleNotFoundError that says nothing about the cause.
        """
        url = self.database_url
        if url.startswith("postgres://"):
            url = f"postgresql://{url[len('postgres://'):]}"
        if url.startswith("postgresql://"):
            url = f"postgresql+psycopg://{url[len('postgresql://'):]}"
        return url

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def hosts(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
