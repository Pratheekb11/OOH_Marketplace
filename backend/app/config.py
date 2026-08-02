from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./adspace.db"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:5500"
    allowed_hosts: str = "localhost,127.0.0.1"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "no-reply@example.com"
    s3_bucket: str | None = None
    s3_region: str = "ap-south-1"
    google_maps_api_key: str | None = None
    gst_validation_url: str | None = None
    gst_validation_api_key: str | None = None
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def hosts(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
