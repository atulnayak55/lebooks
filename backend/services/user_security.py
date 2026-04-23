from datetime import datetime, timedelta, timezone

from email_validator import EmailNotValidError, validate_email
from sqlalchemy.orm import Session

from core.config import settings
from core.security import generate_opaque_token, hash_opaque_token
from database import models


VERIFY_EMAIL_PURPOSE = "verify_email"
RESET_PASSWORD_PURPOSE = "reset_password"


def validate_signup_email(email: str) -> str:
    validated = validate_email(email, check_deliverability=True)
    return validated.normalized


def create_auth_token(
    db: Session,
    *,
    user_id: int,
    purpose: str,
    expires_at: datetime,
) -> tuple[models.AuthToken, str]:
    raw_token = generate_opaque_token()
    db_token = models.AuthToken(
        user_id=user_id,
        purpose=purpose,
        token_hash=hash_opaque_token(raw_token),
        expires_at=expires_at,
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token, raw_token


def revoke_tokens(db: Session, *, user_id: int, purpose: str) -> None:
    db.query(models.AuthToken).filter(
        models.AuthToken.user_id == user_id,
        models.AuthToken.purpose == purpose,
        models.AuthToken.used_at.is_(None),
    ).delete(synchronize_session=False)
    db.commit()


def consume_token(db: Session, *, token: str, purpose: str) -> models.AuthToken | None:
    token_hash = hash_opaque_token(token)
    db_token = db.query(models.AuthToken).filter(
        models.AuthToken.token_hash == token_hash,
        models.AuthToken.purpose == purpose,
    ).first()

    now = datetime.now(timezone.utc)
    if not db_token or db_token.used_at is not None or db_token.expires_at < now:
        return None

    db_token.used_at = now
    db.commit()
    db.refresh(db_token)
    return db_token


def build_verify_email_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=settings.verify_email_token_expire_hours)


def build_reset_password_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=settings.reset_password_token_expire_minutes)


__all__ = [
    "EmailNotValidError",
    "RESET_PASSWORD_PURPOSE",
    "VERIFY_EMAIL_PURPOSE",
    "build_reset_password_expiry",
    "build_verify_email_expiry",
    "consume_token",
    "create_auth_token",
    "revoke_tokens",
    "validate_signup_email",
]
