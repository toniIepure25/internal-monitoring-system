from uuid import UUID
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.notification_channel import NotificationChannel, ChannelType
from app.models.notification_log import NotificationLog, DeliveryStatus
from app.models.subscription import Subscription
from app.models.incident import Incident
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _validate_channel_config(channel_type: ChannelType, config: dict) -> None:
    if channel_type == ChannelType.EMAIL and not config.get("email"):
        raise ValueError("Email channel requires an email address")

    if channel_type == ChannelType.TELEGRAM and not config.get("chat_id"):
        raise ValueError("Telegram channel requires a chat ID")

    if channel_type == ChannelType.BROWSER_PUSH:
        subscription = config.get("subscription")
        if not isinstance(subscription, dict):
            raise ValueError("Browser push channel requires a subscription object")
        if not subscription.get("endpoint"):
            raise ValueError("Browser push channel requires a valid subscription endpoint")


async def create_channel(
    db: AsyncSession,
    user_id: UUID,
    channel_type: str,
    config: dict,
    is_enabled: bool = True,
) -> NotificationChannel:
    try:
        ct = ChannelType(channel_type)
    except ValueError:
        raise ValueError(f"Invalid channel type: {channel_type}. Must be one of: email, browser_push, telegram")

    _validate_channel_config(ct, config)

    existing_result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.user_id == user_id,
            NotificationChannel.channel_type == ct,
        )
    )
    channel = existing_result.scalar_one_or_none()

    if channel:
        channel.config = config
        channel.is_enabled = is_enabled
        await db.flush()
        logger.info("channel_updated", user_id=str(user_id), channel_type=channel_type)
        return channel

    channel = NotificationChannel(user_id=user_id, channel_type=ct, config=config, is_enabled=is_enabled)
    db.add(channel)
    await db.flush()
    logger.info("channel_created", user_id=str(user_id), channel_type=channel_type)
    return channel


async def list_user_channels(
    db: AsyncSession, user_id: UUID
) -> list[NotificationChannel]:
    result = await db.execute(
        select(NotificationChannel)
        .where(NotificationChannel.user_id == user_id)
        .order_by(NotificationChannel.created_at)
    )
    return list(result.scalars().all())


async def update_channel(
    db: AsyncSession, channel_id: UUID, user_id: UUID, **kwargs
) -> Optional[NotificationChannel]:
    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.user_id == user_id,
        )
    )
    channel = result.scalar_one_or_none()
    if not channel:
        return None

    next_config = kwargs.get("config", channel.config)
    next_enabled = kwargs.get("is_enabled", channel.is_enabled)
    _validate_channel_config(channel.channel_type, next_config)

    for key, value in kwargs.items():
        if value is not None and hasattr(channel, key):
            setattr(channel, key, value)

    channel.is_enabled = next_enabled

    await db.flush()
    return channel


async def send_test_notification(
    db: AsyncSession, user_id: UUID, channel_id: UUID,
) -> dict:
    result = await db.execute(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.user_id == user_id,
        )
    )
    channel = result.scalar_one_or_none()
    if not channel:
        raise ValueError("Channel not found")

    # Dispatch test through the appropriate integration
    from app.integrations import telegram, email_sender, web_push

    try:
        if channel.channel_type == ChannelType.TELEGRAM:
            await telegram.send_message(
                channel.config.get("chat_id", ""),
                "Test notification from Internal Monitoring System",
            )
        elif channel.channel_type == ChannelType.EMAIL:
            await email_sender.send_email(
                channel.config.get("email", ""),
                "Test Notification",
                "This is a test notification from the Internal Monitoring System.",
            )
        elif channel.channel_type == ChannelType.BROWSER_PUSH:
            await web_push.send_push(
                channel.config.get("subscription", {}),
                "Test Notification",
                "This is a test from Internal Monitoring System.",
            )

        log_entry = NotificationLog(
            user_id=user_id,
            channel_type=channel.channel_type,
            status=DeliveryStatus.SENT,
            sent_at=datetime.now(timezone.utc),
        )
        db.add(log_entry)
        await db.flush()

        return {"status": "sent", "channel_type": channel.channel_type.value}

    except Exception as e:
        log_entry = NotificationLog(
            user_id=user_id,
            channel_type=channel.channel_type,
            status=DeliveryStatus.FAILED,
            error_message=str(e)[:1000],
        )
        db.add(log_entry)
        await db.flush()

        return {"status": "failed", "error": str(e)}


async def dispatch_incident_notifications(
    db: AsyncSession, incident: Incident, application_name: str,
):
    """Send notifications to all subscribers of the affected application."""
    state = incident.new_state.upper()

    subs_result = await db.execute(
        select(Subscription).where(Subscription.application_id == incident.application_id)
    )
    subscriptions = list(subs_result.scalars().all())

    for sub in subscriptions:
        should_notify = False
        if state == "DOWN" and sub.notify_on_down:
            should_notify = True
        elif state == "UP" and sub.notify_on_up:
            should_notify = True
        elif state == "DEGRADED" and sub.notify_on_degraded:
            should_notify = True
        elif state == "SLOW" and sub.notify_on_slow:
            should_notify = True

        if not should_notify:
            continue

        channels_result = await db.execute(
            select(NotificationChannel).where(
                NotificationChannel.user_id == sub.user_id,
                NotificationChannel.is_enabled == True,
            )
        )
        channels = list(channels_result.scalars().all())

        message = f"{application_name}: {incident.title}"

        for channel in channels:
            log_entry = NotificationLog(
                user_id=sub.user_id,
                subscription_id=sub.id,
                incident_id=incident.id,
                channel_type=channel.channel_type,
                status=DeliveryStatus.PENDING,
            )
            db.add(log_entry)
            await db.flush()

            try:
                from app.integrations import telegram, email_sender, web_push

                if channel.channel_type == ChannelType.TELEGRAM:
                    await telegram.send_message(
                        channel.config.get("chat_id", ""),
                        message,
                    )
                elif channel.channel_type == ChannelType.EMAIL:
                    await email_sender.send_email(
                        channel.config.get("email", ""),
                        f"Alert: {application_name}",
                        message,
                    )
                elif channel.channel_type == ChannelType.BROWSER_PUSH:
                    await web_push.send_push(
                        channel.config.get("subscription", {}),
                        f"Alert: {application_name}",
                        message,
                    )

                log_entry.status = DeliveryStatus.SENT
                log_entry.sent_at = datetime.now(timezone.utc)
            except Exception as e:
                log_entry.status = DeliveryStatus.FAILED
                log_entry.error_message = str(e)[:1000]
                logger.warning(
                    "notification_failed",
                    user_id=str(sub.user_id),
                    channel=channel.channel_type.value,
                    error=str(e),
                )

    await db.flush()
    logger.info(
        "notifications_dispatched",
        incident_id=str(incident.id),
        subscriber_count=len(subscriptions),
    )


async def list_notification_log(
    db: AsyncSession, user_id: UUID, offset: int = 0, limit: int = 50,
) -> tuple[list[NotificationLog], int]:
    query = (
        select(NotificationLog)
        .options(
            selectinload(NotificationLog.incident).selectinload(Incident.application),
            selectinload(NotificationLog.incident).selectinload(Incident.host),
        )
        .where(NotificationLog.user_id == user_id)
        .order_by(NotificationLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    count_query = select(func.count(NotificationLog.id)).where(NotificationLog.user_id == user_id)

    result = await db.execute(query)
    total_result = await db.execute(count_query)
    return list(result.scalars().all()), total_result.scalar_one()
