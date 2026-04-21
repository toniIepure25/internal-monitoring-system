from uuid import UUID
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import Application, DetectionSource
from app.models.application_status import ApplicationStatus, AppState
from app.models.health_check import HealthCheck
from app.utils.url import normalize_url
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def create_application(
    db: AsyncSession,
    display_name: str,
    base_url: str,
    created_by: UUID,
    health_url: Optional[str] = None,
    environment: Optional[str] = None,
    monitoring_interval_seconds: Optional[int] = None,
) -> Application:
    normalized = normalize_url(base_url)

    existing = await db.execute(
        select(Application).where(Application.normalized_url == normalized)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Application with URL '{base_url}' already exists (normalized: {normalized})")

    detection_source = DetectionSource.MANUAL if health_url else DetectionSource.AUTO

    app = Application(
        display_name=display_name,
        base_url=base_url.strip(),
        normalized_url=normalized,
        health_url=health_url,
        detection_source=detection_source,
        environment=environment,
        created_by=created_by,
        monitoring_interval_seconds=monitoring_interval_seconds or 60,
    )
    db.add(app)
    await db.flush()

    status = ApplicationStatus(application_id=app.id)
    db.add(status)
    await db.flush()

    # Re-fetch with eager loading to avoid lazy-load in async context
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.status))
        .where(Application.id == app.id)
    )
    app = result.scalar_one()

    logger.info("application_created", app_id=str(app.id), url=normalized)
    return app


async def delete_application(db: AsyncSession, app_id: UUID) -> bool:
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        return False

    await db.delete(app)
    await db.flush()
    logger.info("application_deleted", app_id=str(app_id), url=app.normalized_url)
    return True


async def get_application(db: AsyncSession, app_id: UUID) -> Optional[Application]:
    result = await db.execute(
        select(Application)
        .options(
            selectinload(Application.status),
            selectinload(Application.health_candidates),
        )
        .where(Application.id == app_id)
    )
    return result.scalar_one_or_none()


async def list_applications(
    db: AsyncSession,
    search: Optional[str] = None,
    environment: Optional[str] = None,
    is_active: Optional[bool] = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[Application], int]:
    query = select(Application).options(selectinload(Application.status))
    count_query = select(func.count(Application.id))

    if search:
        pattern = f"%{search}%"
        query = query.where(
            Application.display_name.ilike(pattern) | Application.base_url.ilike(pattern)
        )
        count_query = count_query.where(
            Application.display_name.ilike(pattern) | Application.base_url.ilike(pattern)
        )

    if environment:
        query = query.where(Application.environment == environment)
        count_query = count_query.where(Application.environment == environment)

    if is_active is not None:
        query = query.where(Application.is_active == is_active)
        count_query = count_query.where(Application.is_active == is_active)

    query = query.order_by(Application.display_name).offset(offset).limit(limit)

    result = await db.execute(query)
    total_result = await db.execute(count_query)

    return list(result.scalars().all()), total_result.scalar_one()


async def update_application(
    db: AsyncSession, app_id: UUID, **kwargs
) -> Optional[Application]:
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.status))
        .where(Application.id == app_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(app, key):
            setattr(app, key, value)

    await db.flush()
    return app


async def set_health_url(
    db: AsyncSession, app_id: UUID, health_url: str
) -> Optional[Application]:
    from app.models.health_candidate import HealthCandidate

    result = await db.execute(
        select(Application)
        .options(selectinload(Application.status))
        .where(Application.id == app_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        return None

    app.health_url = health_url
    app.detection_source = DetectionSource.MANUAL

    candidates_result = await db.execute(
        select(HealthCandidate).where(HealthCandidate.application_id == app_id)
    )
    for c in candidates_result.scalars().all():
        c.is_selected = (c.url == health_url)

    await db.flush()
    logger.info("health_url_set", app_id=str(app_id), health_url=health_url)
    return app


async def get_state_since_map(
    db: AsyncSession, apps: list,
) -> dict[UUID, str]:
    """Return {app_id: iso_timestamp} for when each app entered its current state.

    Finds the most recent health check with a *different* status, then looks up
    the first check with the current status after that point.  If no different
    status exists, uses the oldest health check for the app.
    """
    if not apps:
        return {}

    result_map: dict[UUID, str] = {}
    for app in apps:
        current = app.status.status if app.status else None
        if current is None:
            continue

        last_diff = await db.execute(
            select(HealthCheck.checked_at)
            .where(
                HealthCheck.application_id == app.id,
                HealthCheck.status != current,
            )
            .order_by(HealthCheck.checked_at.desc())
            .limit(1)
        )
        last_diff_at = last_diff.scalar_one_or_none()

        if last_diff_at:
            first_current = await db.execute(
                select(func.min(HealthCheck.checked_at))
                .where(
                    HealthCheck.application_id == app.id,
                    HealthCheck.status == current,
                    HealthCheck.checked_at > last_diff_at,
                )
            )
            since = first_current.scalar_one_or_none()
            if since:
                result_map[app.id] = since.isoformat()
        else:
            oldest = await db.execute(
                select(func.min(HealthCheck.checked_at))
                .where(HealthCheck.application_id == app.id)
            )
            oldest_at = oldest.scalar_one_or_none()
            if oldest_at:
                result_map[app.id] = oldest_at.isoformat()

    return result_map


async def get_health_history(
    db: AsyncSession, app_id: UUID, limit: int = 30,
) -> list[HealthCheck]:
    result = await db.execute(
        select(HealthCheck)
        .where(HealthCheck.application_id == app_id)
        .order_by(HealthCheck.checked_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
