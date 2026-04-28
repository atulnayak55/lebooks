from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Backend API"
    database_url: str = "postgresql://user:password123@localhost:5432/bobooks"
    jwt_secret_key: str = "super-secret-bobooks-key-change-me-later"
    jwt_algorithm: str = "HS256"
    access_token_expire_days: int = 7
    azure_communication_email_connection_string: str | None = Field(
        default=None,
        alias="azure_communication_email_connection_string",
    )
    email_dev_fallback: bool | None = Field(default=None, alias="email_dev_fallback")
    email_from: str = "onboarding@lebooks.it"
    email_logo_url: str | None = Field(default=None, alias="email_logo_url")
    frontend_url: str = "http://localhost:5173"
    backend_base_url: str = "http://localhost:8000"
    verify_email_token_expire_hours: int = 24
    reset_password_token_expire_minutes: int = 30
    upload_max_bytes: int = 5 * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


settings = Settings()
