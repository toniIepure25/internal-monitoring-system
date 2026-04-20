import httpx
from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def send_message(chat_id: str, text: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("telegram_not_configured", detail="TELEGRAM_BOT_TOKEN not set")
        raise ValueError("Telegram bot not configured")

    if not chat_id:
        raise ValueError("Telegram chat_id is required")

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )

    if resp.status_code != 200:
        logger.error("telegram_send_failed", status=resp.status_code, body=resp.text[:500])
        raise ValueError(f"Telegram API error: {resp.status_code}")

    logger.info("telegram_sent", chat_id=chat_id)
    return True
