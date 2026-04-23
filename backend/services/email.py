from urllib.parse import urlencode

import resend

from core.config import settings


def _get_configured_sender() -> str:
    return settings.email_from


def _send_email(*, to: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("RESEND API key is not configured")

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": _get_configured_sender(),
            "to": [to],
            "subject": subject,
            "html": html,
        }
    )


def send_signup_otp_email(*, recipient_email: str, recipient_name: str, otp_code: str) -> None:
    html = f"""
    <div>
      <h2>Your lebooks verification code</h2>
      <p>Hi {recipient_name},</p>
      <p>Use this code to finish creating your lebooks account:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{otp_code}</p>
      <p>This code expires in 10 minutes.</p>
      <p>A NAKED MAN FEARS NO PICKPOCKET</p>
    </div>
    """

    _send_email(
        to=recipient_email,
        subject="Your lebooks verification code",
        html=html,
    )


def send_password_reset_email(*, recipient_email: str, recipient_name: str, token: str) -> None:
    reset_query = urlencode({"token": token})
    reset_link = f"{settings.frontend_url.rstrip('/')}/reset-password?{reset_query}"

    html = f"""
    <div>
      <h2>Reset your lebooks password</h2>
      <p>Hi {recipient_name},</p>
      <p>We received a request to reset your password. Click below to choose a new one.</p>
      <p><a href="{reset_link}">Reset password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
    """

    _send_email(
        to=recipient_email,
        subject="Reset your lebooks password",
        html=html,
    )
