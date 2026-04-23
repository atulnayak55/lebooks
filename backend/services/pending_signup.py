from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import secrets
import threading


OTP_TTL_MINUTES = 10


@dataclass
class PendingSignup:
    name: str
    email: str
    unipd_id: str | None
    hashed_password: str
    otp_code: str
    expires_at: datetime


class PendingSignupStore:
    def __init__(self) -> None:
        self._by_email: dict[str, PendingSignup] = {}
        self._lock = threading.Lock()

    def create_or_replace(
        self,
        *,
        name: str,
        email: str,
        unipd_id: str | None,
        hashed_password: str,
    ) -> PendingSignup:
        pending_signup = PendingSignup(
            name=name,
            email=email,
            unipd_id=unipd_id,
            hashed_password=hashed_password,
            otp_code=f"{secrets.randbelow(1_000_000):06d}",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
        )
        with self._lock:
            self._cleanup_locked()
            self._by_email[email] = pending_signup
        return pending_signup

    def verify(self, *, email: str, otp_code: str) -> PendingSignup | None:
        with self._lock:
            self._cleanup_locked()
            pending_signup = self._by_email.get(email)
            if not pending_signup:
                return None
            if pending_signup.otp_code != otp_code:
                return None
            del self._by_email[email]
            return pending_signup

    def resend(self, *, email: str) -> PendingSignup | None:
        with self._lock:
            self._cleanup_locked()
            existing = self._by_email.get(email)
            if not existing:
                return None
            refreshed = PendingSignup(
                name=existing.name,
                email=existing.email,
                unipd_id=existing.unipd_id,
                hashed_password=existing.hashed_password,
                otp_code=f"{secrets.randbelow(1_000_000):06d}",
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
            )
            self._by_email[email] = refreshed
            return refreshed

    def _cleanup_locked(self) -> None:
        now = datetime.now(timezone.utc)
        expired_emails = [
            email for email, signup in self._by_email.items() if signup.expires_at <= now
        ]
        for email in expired_emails:
            del self._by_email[email]


pending_signup_store = PendingSignupStore()
