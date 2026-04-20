from uuid import UUID
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.subscription import Subscription
from app.models.application import Application
from app.models.application_status import ApplicationStatus
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def create_subscription(
    db: AsyncSession,
    user_id: UUID,
    application_id: UUID,
    notify_on_down: bool = True,
    notify_on_up: bool = True,
    notify_on_degraded: bool = False,
    notify_on_slow: bool = False,
) -> Subscription:
    existing = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user_id,
            Subscription.application_id == application_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Already subscribed to this application")

    app_exists = await db.execute(
        select(Application.id).where(Application.id == application_id)
    )
    if not app_exists.scalar_one_or_none():
        raise ValueError("Application not found")

    sub = Subscription(
        user_id=user_id,
        application_id=application_id,
        notify_on_down=notify_on_down,
        notify_on_up=notify_on_up,
        notify_on_degraded=notify_on_degraded,
        notify_on_slow=notify_on_slow,
    )
    db.add(sub)
    await db.flush()

    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.application).selectinload(Application.status))
        .where(Subscription.id == sub.id)
    )
    sub = result.scalar_one()

    logger.info("subscription_created", user_id=str(user_id), app_id=str(application_id))
    return sub


async def list_user_subscriptions(
    db: AsyncSession, user_id: UUID, offset: int = 0, limit: int = 50
) -> tuple[list[Subscription], int]:
    query = (
        select(Subscription)
        .options(
            selectinload(Subscription.application).selectinload(Application.status),
        )
        .where(Subscription.user_id == user_id)
        .order_by(Subscription.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    count_query = select(func.count(Subscription.id)).where(Subscription.user_id == user_id)

    result = await db.execute(query)
    total_result = await db.execute(count_query)
    return list(result.scalars().all()), total_result.scalar_one()


async def update_subscription(
    db: AsyncSession, sub_id: UUID, user_id: UUID, **kwargs
) -> Optional[Subscription]:
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.application).selectinload(Application.status))
        .where(Subscription.id == sub_id, Subscription.user_id == user_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(sub, key):
            setattr(sub, key, value)

    await db.flush()
    return sub


async def delete_subscription(db: AsyncSession, sub_id: UUID, user_id: UUID) -> bool:
    result = await db.execute(
        select(Subscription).where(
            Subscription.id == sub_id, Subscription.user_id == user_id
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return False

    await db.delete(sub)
    await db.flush()
    return True
