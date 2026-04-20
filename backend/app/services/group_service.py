from uuid import UUID
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user_group import UserGroup
from app.models.user_group_application import UserGroupApplication
from app.models.application import Application
from app.models.application_status import ApplicationStatus
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def create_group(
    db: AsyncSession, user_id: UUID, name: str, color: Optional[str] = None
) -> UserGroup:
    group = UserGroup(user_id=user_id, name=name, color=color)
    db.add(group)
    await db.flush()
    logger.info("group_created", user_id=str(user_id), group_id=str(group.id))
    return group


async def list_user_groups(db: AsyncSession, user_id: UUID) -> list[UserGroup]:
    result = await db.execute(
        select(UserGroup)
        .options(
            selectinload(UserGroup.group_applications)
            .selectinload(UserGroupApplication.application)
            .selectinload(Application.status),
        )
        .where(UserGroup.user_id == user_id)
        .order_by(UserGroup.display_order, UserGroup.name)
    )
    return list(result.scalars().all())


async def update_group(
    db: AsyncSession, group_id: UUID, user_id: UUID, **kwargs
) -> Optional[UserGroup]:
    result = await db.execute(
        select(UserGroup).where(
            UserGroup.id == group_id, UserGroup.user_id == user_id
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(group, key):
            setattr(group, key, value)

    await db.flush()
    return group


async def delete_group(db: AsyncSession, group_id: UUID, user_id: UUID) -> bool:
    result = await db.execute(
        select(UserGroup).where(
            UserGroup.id == group_id, UserGroup.user_id == user_id
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        return False

    await db.delete(group)
    await db.flush()
    return True


async def add_application_to_group(
    db: AsyncSession, group_id: UUID, user_id: UUID, application_id: UUID, display_order: int = 0
) -> UserGroupApplication:
    group_result = await db.execute(
        select(UserGroup).where(
            UserGroup.id == group_id, UserGroup.user_id == user_id
        )
    )
    if not group_result.scalar_one_or_none():
        raise ValueError("Group not found")

    existing = await db.execute(
        select(UserGroupApplication).where(
            UserGroupApplication.group_id == group_id,
            UserGroupApplication.application_id == application_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Application already in group")

    ga = UserGroupApplication(
        group_id=group_id,
        application_id=application_id,
        display_order=display_order,
    )
    db.add(ga)
    await db.flush()
    return ga


async def remove_application_from_group(
    db: AsyncSession, group_id: UUID, user_id: UUID, application_id: UUID
) -> bool:
    group_result = await db.execute(
        select(UserGroup).where(
            UserGroup.id == group_id, UserGroup.user_id == user_id
        )
    )
    if not group_result.scalar_one_or_none():
        return False

    result = await db.execute(
        select(UserGroupApplication).where(
            UserGroupApplication.group_id == group_id,
            UserGroupApplication.application_id == application_id,
        )
    )
    ga = result.scalar_one_or_none()
    if not ga:
        return False

    await db.delete(ga)
    await db.flush()
    return True
