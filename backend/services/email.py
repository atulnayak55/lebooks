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


def _get_logo_url() -> str:
    if settings.email_logo_url:
        return settings.email_logo_url

    return f"{settings.frontend_url.rstrip('/')}/lebooks.png"


def _is_local_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.hostname in {"localhost", "127.0.0.1"}


def _allow_dev_fallback() -> bool:
    if settings.email_dev_fallback is not None:
        return settings.email_dev_fallback

    return _is_local_url(settings.frontend_url) and _is_local_url(settings.backend_base_url)


def email_delivery_enabled() -> bool:
    return bool(settings.azure_communication_email_connection_string) or _allow_dev_fallback()


def _brand_email(*, title: str, preheader: str, body_html: str) -> str:
    safe_title = escape(title)
    safe_preheader = escape(preheader)
    logo_url = escape(_get_logo_url(), quote=True)

    return f"""
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background:#f4f7ef; font-family:Arial, Helvetica, sans-serif; color:#151515;">
        <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
          {safe_preheader}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7ef; padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px; background:#ffffff; border:1px solid #dde6d5; border-radius:14px; overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px 18px; border-bottom:1px solid #e4eadf;">
                    <img src="{logo_url}" alt="lebooks" width="140" style="display:block; max-width:140px; height:auto; margin:0 0 18px;">
                    <p style="margin:0 0 8px; color:#2f7d32; font-size:12px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase;">lebooks</p>
                    <h1 style="margin:0; color:#151515; font-size:24px; line-height:1.25;">{safe_title}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 28px 28px; font-size:15px; line-height:1.6;">
                    {body_html}
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px; background:#f8faf5; border-top:1px solid #e4eadf; color:#667064; font-size:12px; line-height:1.5;">
                    This is a service email from Lebooks. If you did not request this or do not recognise the activity, contact info@lebooks.it.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """


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
    body_html = f"""
    <p style="margin:0 0 14px;">Hi {safe_name},</p>
    <p style="margin:0 0 18px;">Use this code to finish creating your Lebooks account:</p>
    <div style="display:inline-block; padding:14px 18px; margin:0 0 18px; background:#eef7e9; border:1px solid #cfe7c5; border-radius:10px; color:#1f5f24; font-size:30px; font-weight:700; letter-spacing:7px;">{otp_code}</div>
    <p style="margin:0 0 10px;">This code expires in 10 minutes.</p>
    <p style="margin:0;">If you did not request this code, you can ignore this email.</p>
    """

    _send_email(
        to=recipient_email,
        subject="Your lebooks verification code",
        html=_brand_email(
            title="Your verification code",
            preheader="Use this code to finish creating your Lebooks account.",
            body_html=body_html,
        ),
    )


def send_password_reset_email(*, recipient_email: str, recipient_name: str, token: str) -> None:
    reset_query = urlencode({"token": token})
    reset_link = f"{settings.frontend_url.rstrip('/')}/reset-password?{reset_query}"
    safe_name = escape(recipient_name)

    body_html = f"""
    <p style="margin:0 0 14px;">Hi {safe_name},</p>
    <p style="margin:0 0 20px;">We received a request to reset your Lebooks password. Click below to choose a new one.</p>
    <p style="margin:0 0 20px;"><a href="{reset_link}" style="display:inline-block; background:#4f9d45; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:700;">Reset password</a></p>
    <p style="margin:0;">If you did not request this, you can ignore this email.</p>
    """

    _send_email(
        to=recipient_email,
        subject="Reset your lebooks password",
        html=_brand_email(
            title="Reset your password",
            preheader="Choose a new password for your Lebooks account.",
            body_html=body_html,
        ),
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

    body_html = f"""
    <p style="margin:0 0 14px;">Hi {safe_recipient_name},</p>
    <p style="margin:0 0 18px;"><strong>{safe_sender_name}</strong> sent you a message on Lebooks about <strong>{safe_listing_title}</strong>.</p>
    <p style="margin:0 0 8px; color:#667064; font-size:13px; font-weight:700;">Message preview</p>
    <div style="margin:0 0 20px; padding:14px 16px; background:#f4f7ef; border-left:4px solid #4f9d45; border-radius:8px;">{safe_message_preview}</div>
    <p style="margin:0 0 20px;"><a href="{inbox_link}" style="display:inline-block; background:#4f9d45; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:10px; font-weight:700;">Open Lebooks to reply</a></p>
    <p style="margin:0;">If you are already chatting in Lebooks, you can ignore this email.</p>
    """

    _send_email(
        to=recipient_email,
        subject=f"New message about {listing_title}",
        html=_brand_email(
            title="New message on Lebooks",
            preheader=f"{sender_name} sent you a message about {listing_title}.",
            body_html=body_html,
        ),
    )
