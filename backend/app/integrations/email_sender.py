import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def send_email(to_email: str, subject: str, body: str) -> bool:
    if not settings.SMTP_HOST:
        logger.warning("smtp_not_configured", detail="SMTP_HOST not set")
        raise ValueError("Email (SMTP) not configured")

    if not to_email:
        raise ValueError("Recipient email is required")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    html_body = f"""
    <html>
    <body style="font-family: -apple-system, sans-serif; padding: 20px;">
        <h2 style="color: #1e40af;">{subject}</h2>
        <p style="font-size: 14px; color: #374151;">{body}</p>
        <hr style="border-color: #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #9ca3af;">Internal Monitoring System</p>
    </body>
    </html>
    """
    msg.attach(MIMEText(body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER or None,
        password=settings.SMTP_PASSWORD or None,
        use_tls=settings.SMTP_TLS,
        timeout=10,
    )

    logger.info("email_sent", to=to_email, subject=subject)
    return True
