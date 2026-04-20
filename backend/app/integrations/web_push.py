import json
import os
import tempfile
from pywebpush import webpush, WebPushException

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def send_push(subscription_info: dict, title: str, body: str) -> bool:
    if not settings.VAPID_PRIVATE_KEY:
        logger.warning("vapid_not_configured", detail="VAPID_PRIVATE_KEY not set")
        raise ValueError("Browser push (VAPID) not configured")

    if not subscription_info or "endpoint" not in subscription_info:
        raise ValueError("Invalid push subscription")

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/favicon.ico",
        "badge": "/favicon.ico",
    })

    try:
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".pem") as key_file:
            key_file.write(settings.VAPID_PRIVATE_KEY)
            key_path = key_file.name

        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=key_path,
            vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIMS_EMAIL}"},
        )
    except WebPushException as e:
        logger.error("web_push_failed", error=str(e))
        raise ValueError(f"Push notification failed: {str(e)}")
    finally:
        if "key_path" in locals():
            try:
                os.unlink(key_path)
            except OSError:
                logger.warning("temp_vapid_key_cleanup_failed", path=key_path)

    logger.info("web_push_sent")
    return True
