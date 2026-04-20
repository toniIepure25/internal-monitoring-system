from uuid import UUID
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.incident import Incident, IncidentStatus, IncidentSeverity
from app.models.application import Application
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _determine_severity(new_state: str) -> IncidentSeverity:
    if new_state == "DOWN":
        return IncidentSeverity.CRITICAL
    elif new_state in ("DEGRADED", "SLOW"):
        return IncidentSeverity.WARNING
    else:
        return IncidentSeverity.INFO


async def create_incident(
    db: AsyncSession,
    application_id: UUID,
    previous_state: str,
    new_state: str,
    app_name: str = "",
    incident_type: str = "APPLICATION",
    host_id: UUID | None = None,
) -> Incident:
    severity = _determine_severity(new_state)

    if new_state == "DOWN":
        title = f"{app_name} is DOWN"
        if incident_type == "HOST_CAUSED":
            title = f"{app_name} is DOWN (host offline)"
    elif new_state == "UP":
        title = f"{app_name} recovered (was {previous_state})"
    elif new_state == "DEGRADED":
        title = f"{app_name} is DEGRADED"
    elif new_state == "SLOW":
        title = f"{app_name} is responding slowly"
    else:
        title = f"{app_name} state changed: {previous_state} -> {new_state}"

    incident = Incident(
        application_id=application_id,
        host_id=host_id,
        incident_type=incident_type,
        title=title,
        severity=severity,
        previous_state=previous_state,
        new_state=new_state,
    )
    db.add(incident)
    await db.flush()

    logger.info(
        "incident_created",
        incident_id=str(incident.id),
        app_id=str(application_id),
        transition=f"{previous_state}->{new_state}",
        severity=severity.value,
        incident_type=incident_type,
    )
    return incident


async def resolve_ongoing_incidents(
    db: AsyncSession, application_id: UUID
) -> list[Incident]:
    result = await db.execute(
        select(Incident).where(
            Incident.application_id == application_id,
            Incident.status == IncidentStatus.ONGOING,
        )
    )
    incidents = list(result.scalars().all())
    now = datetime.now(timezone.utc)
    for inc in incidents:
        inc.status = IncidentStatus.RESOLVED
        inc.resolved_at = now

    await db.flush()
    return incidents


async def list_incidents(
    db: AsyncSession,
    application_id: Optional[UUID] = None,
    host_id: Optional[UUID] = None,
    status: Optional[str] = None,
    incident_type: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[Incident], int]:
    query = select(Incident).options(
        selectinload(Incident.application),
        selectinload(Incident.host),
    )
    count_query = select(func.count(Incident.id))

    if application_id:
        query = query.where(Incident.application_id == application_id)
        count_query = count_query.where(Incident.application_id == application_id)

    if host_id:
        query = query.where(Incident.host_id == host_id)
        count_query = count_query.where(Incident.host_id == host_id)

    if status:
        query = query.where(Incident.status == status)
        count_query = count_query.where(Incident.status == status)

    if incident_type:
        query = query.where(Incident.incident_type == incident_type)
        count_query = count_query.where(Incident.incident_type == incident_type)

    query = query.order_by(Incident.started_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    total_result = await db.execute(count_query)
    return list(result.scalars().all()), total_result.scalar_one()


async def get_incident(db: AsyncSession, incident_id: UUID) -> Optional[Incident]:
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.application))
        .where(Incident.id == incident_id)
    )
    return result.scalar_one_or_none()
