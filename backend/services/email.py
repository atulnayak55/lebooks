import logging
from html import escape
from urllib.parse import urlencode
from urllib.parse import urlparse

from azure.communication.email import EmailClient

from core.config import settings


logger = logging.getLogger(__name__)


class EmailDeliveryError(RuntimeError):
    pass


def _get_configured_sender() -> str:
    return settings.email_from


def _is_local_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.hostname in {"localhost", "127.0.0.1"}


def _allow_dev_fallback() -> bool:
    if settings.email_dev_fallback is not None:
        return settings.email_dev_fallback

    return _is_local_url(settings.frontend_url) and _is_local_url(settings.backend_base_url)


def email_delivery_enabled() -> bool:
    return bool(settings.azure_communication_email_connection_string) or _allow_dev_fallback()


def _send_email(*, to: str, subject: str, html: str) -> None:
    if not settings.azure_communication_email_connection_string:
        if not _allow_dev_fallback():
            raise EmailDeliveryError("Email delivery is not configured")

        print(f"[email-dev-fallback] To: {to}")
        print(f"[email-dev-fallback] Subject: {subject}")
        print(html)
        return

    try:
        email_client = EmailClient.from_connection_string(
            settings.azure_communication_email_connection_string,
        )
        poller = email_client.begin_send(
            {
                "senderAddress": _get_configured_sender(),
                "recipients": {
                    "to": [{"address": to}],
                },
                "content": {
                    "subject": subject,
                    "html": html,
                },
            }
        )
        poller.result()
    except Exception as exc:
        if _allow_dev_fallback():
            print(f"[email-dev-fallback] Delivery failed: {exc}")
            print(f"[email-dev-fallback] To: {to}")
            print(f"[email-dev-fallback] Subject: {subject}")
            print(html)
            return

        logger.exception("Email delivery failed for subject '%s'", subject)
        raise EmailDeliveryError("Email delivery failed") from exc


def send_signup_otp_email(*, recipient_email: str, recipient_name: str, otp_code: str) -> None:
    safe_name = escape(recipient_name)
    html = f"""
    <div>
      <h2>Your lebooks verification code</h2>
      <p>Hi {safe_name},</p>
      <p>Use this code to finish creating your lebooks account:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{otp_code}</p>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this code, you can ignore this email.</p>
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
    safe_name = escape(recipient_name)

    html = f"""
    <div>
      <h2>Reset your lebooks password</h2>
      <p>Hi {safe_name},</p>
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


def send_offline_chat_email(
    *,
    recipient_email: str,
    recipient_name: str,
    sender_name: str,
    listing_title: str,
    message_preview: str,
) -> None:
    safe_recipient_name = escape(recipient_name)
    safe_sender_name = escape(sender_name)
    safe_listing_title = escape(listing_title)
    safe_message_preview = escape(message_preview)
    inbox_link = settings.frontend_url.rstrip("/")

    html = f"""
    <div>
      <h2>You have a new lebooks message</h2>
      <p>Hi {safe_recipient_name},</p>
      <p>{safe_sender_name} sent you a message about <strong>{safe_listing_title}</strong>.</p>
      <blockquote>{safe_message_preview}</blockquote>
      <p><a href="{inbox_link}">Open lebooks to reply</a></p>
      <p>If you are already chatting in lebooks, you can ignore this email.</p>
    </div>
    """

    _send_email(
        to=recipient_email,
        subject=f"New message about {listing_title}",
        html=html,
    )
