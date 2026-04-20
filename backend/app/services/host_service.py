from uuid import UUID
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.host import Host, HostState, generate_api_key
from app.models.host_status import HostStatus
from app.models.host_heartbeat import HostHeartbeat
from app.models.application_host import ApplicationHost
from app.models.application import Application
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def create_host(
    db: AsyncSession,
    hostname: str,
    display_name: str,
    created_by: UUID,
    environment: Optional[str] = None,
    tags: Optional[dict] = None,
    heartbeat_interval_seconds: int = 30,
    heartbeat_timeout_seconds: int = 90,
) -> Host:
    existing = await db.execute(
        select(Host).where(Host.hostname == hostname)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Host with hostname '{hostname}' already exists")

    host = Host(
        hostname=hostname,
        display_name=display_name,
        created_by=created_by,
        environment=environment,
        tags=tags or {},
        heartbeat_interval_seconds=heartbeat_interval_seconds,
        heartbeat_timeout_seconds=heartbeat_timeout_seconds,
    )
    db.add(host)
    await db.flush()

    status = HostStatus(host_id=host.id)
    db.add(status)
    await db.flush()

    result = await db.execute(
        select(Host).options(selectinload(Host.status)).where(Host.id == host.id)
    )
    host = result.scalar_one()

    logger.info("host_created", host_id=str(host.id), hostname=hostname)
    return host


async def get_host(db: AsyncSession, host_id: UUID) -> Optional[Host]:
    result = await db.execute(
        select(Host)
        .options(
            selectinload(Host.status),
            selectinload(Host.application_hosts).selectinload(ApplicationHost.application),
        )
        .where(Host.id == host_id)
    )
    return result.scalar_one_or_none()


async def get_host_by_api_key(db: AsyncSession, api_key: str) -> Optional[Host]:
    result = await db.execute(
        select(Host).options(selectinload(Host.status)).where(Host.api_key == api_key)
    )
    return result.scalar_one_or_none()


async def list_hosts(
    db: AsyncSession,
    search: Optional[str] = None,
    environment: Optional[str] = None,
    is_active: Optional[bool] = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[Host], int]:
    query = select(Host).options(selectinload(Host.status))
    count_query = select(func.count(Host.id))

    if search:
        pattern = f"%{search}%"
        query = query.where(Host.hostname.ilike(pattern) | Host.display_name.ilike(pattern))
        count_query = count_query.where(Host.hostname.ilike(pattern) | Host.display_name.ilike(pattern))

    if environment:
        query = query.where(Host.environment == environment)
        count_query = count_query.where(Host.environment == environment)

    if is_active is not None:
        query = query.where(Host.is_active == is_active)
        count_query = count_query.where(Host.is_active == is_active)

    query = query.order_by(Host.display_name).offset(offset).limit(limit)

    result = await db.execute(query)
    total_result = await db.execute(count_query)
    return list(result.scalars().all()), total_result.scalar_one()


async def update_host(db: AsyncSession, host_id: UUID, **kwargs) -> Optional[Host]:
    result = await db.execute(
        select(Host).options(selectinload(Host.status)).where(Host.id == host_id)
    )
    host = result.scalar_one_or_none()
    if not host:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(host, key):
            setattr(host, key, value)

    await db.flush()
    return host


async def regenerate_api_key(db: AsyncSession, host_id: UUID) -> Optional[str]:
    result = await db.execute(select(Host).where(Host.id == host_id))
    host = result.scalar_one_or_none()
    if not host:
        return None

    host.api_key = generate_api_key()
    await db.flush()
    logger.info("host_api_key_regenerated", host_id=str(host_id))
    return host.api_key


async def link_application(
    db: AsyncSession, host_id: UUID, application_id: UUID
) -> ApplicationHost:
    existing = await db.execute(
        select(ApplicationHost).where(
            ApplicationHost.host_id == host_id,
            ApplicationHost.application_id == application_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Application already linked to this host")

    app_exists = await db.execute(
        select(Application.id).where(Application.id == application_id)
    )
    if not app_exists.scalar_one_or_none():
        raise ValueError("Application not found")

    binding = ApplicationHost(host_id=host_id, application_id=application_id)
    db.add(binding)
    await db.flush()
    logger.info("app_linked_to_host", host_id=str(host_id), app_id=str(application_id))
    return binding


async def unlink_application(
    db: AsyncSession, host_id: UUID, application_id: UUID
) -> bool:
    result = await db.execute(
        select(ApplicationHost).where(
            ApplicationHost.host_id == host_id,
            ApplicationHost.application_id == application_id,
        )
    )
    binding = result.scalar_one_or_none()
    if not binding:
        return False

    await db.delete(binding)
    await db.flush()
    return True


async def get_recent_heartbeats(
    db: AsyncSession, host_id: UUID, limit: int = 20
) -> list[HostHeartbeat]:
    result = await db.execute(
        select(HostHeartbeat)
        .where(HostHeartbeat.host_id == host_id)
        .order_by(HostHeartbeat.received_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
