from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession
from app.models.application import Application
from app.models.application_status import AppState
from app.models.health_check import HealthCheck
from app.models.incident import Incident
from app.services import application_service

router = APIRouter()


def _app_status_serialized(s, current_state_since: str | None = None) -> dict | None:
    if not s:
        return None
    return {
        "status": s.status.value if hasattr(s.status, "value") else s.status,
        "last_checked_at": s.last_checked_at.isoformat() if s.last_checked_at else None,
        "last_response_time_ms": s.last_response_time_ms,
        "last_http_status": s.last_http_status,
        "current_state_since": current_state_since,
    }


@router.get("/status")
async def public_status(db: DbSession):
    """Unauthenticated endpoint returning current status of all active applications."""
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.status))
        .where(Application.is_active == True)
        .order_by(Application.display_name)
    )
    apps = list(result.scalars().all())

    since_map = await application_service.get_state_since_map(db, [a.id for a in apps])

    statuses = [a.status for a in apps if a.status]
    down_count = sum(1 for s in statuses if s.status == AppState.DOWN)
    slow_count = sum(1 for s in statuses if s.status in (AppState.SLOW, AppState.DEGRADED))

    if down_count > 0:
        overall = "MAJOR_OUTAGE" if down_count > 1 else "PARTIAL_OUTAGE"
    elif slow_count > 0:
        overall = "DEGRADED"
    elif len(statuses) > 0:
        overall = "OPERATIONAL"
    else:
        overall = "UNKNOWN"

    inc_result = await db.execute(
        select(Incident)
        .order_by(Incident.started_at.desc())
        .limit(10)
    )
    incidents = list(inc_result.scalars().all())

    return {
        "overall_status": overall,
        "applications": [
            {
                "id": str(a.id),
                "display_name": a.display_name,
                "base_url": a.base_url,
                "status": _app_status_serialized(
                    a.status,
                    current_state_since=since_map.get(a.id) or (a.created_at.isoformat() if a.created_at else None),
                ),
            }
            for a in apps
        ],
        "recent_incidents": [
            {
                "id": str(i.id),
                "title": i.title,
                "status": i.status.value if hasattr(i.status, "value") else i.status,
                "severity": i.severity.value if hasattr(i.severity, "value") else i.severity,
                "started_at": i.started_at.isoformat() if i.started_at else None,
                "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
            }
            for i in incidents
        ],
    }


@router.get("/status/{app_id}/health-history")
async def public_health_history(
    app_id: str, db: DbSession, limit: int = Query(30, ge=1, le=100),
):
    """Unauthenticated health history for a single application."""
    result = await db.execute(
        select(HealthCheck)
        .where(HealthCheck.application_id == app_id)
        .order_by(HealthCheck.checked_at.desc())
        .limit(limit)
    )
    checks = list(result.scalars().all())
    return {
        "items": [
            {
                "id": str(c.id),
                "status": c.status.value if hasattr(c.status, "value") else c.status,
                "response_time_ms": c.response_time_ms,
                "checked_at": c.checked_at.isoformat() if c.checked_at else None,
            }
            for c in checks
        ]
    }
