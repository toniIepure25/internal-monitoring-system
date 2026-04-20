from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import DbSession, CurrentUser
from app.schemas.incident import IncidentResponse, IncidentListResponse
from app.services import incident_service

router = APIRouter()


def _serialize_incident(inc) -> dict:
    app_name = None
    if hasattr(inc, "application") and inc.application:
        app_name = inc.application.display_name
    host_name = None
    if hasattr(inc, "host") and inc.host:
        host_name = inc.host.display_name
    return {
        "id": str(inc.id),
        "application_id": str(inc.application_id) if inc.application_id else None,
        "host_id": str(inc.host_id) if inc.host_id else None,
        "incident_type": inc.incident_type or "APPLICATION",
        "title": inc.title,
        "status": inc.status.value if hasattr(inc.status, "value") else inc.status,
        "severity": inc.severity.value if hasattr(inc.severity, "value") else inc.severity,
        "previous_state": inc.previous_state,
        "new_state": inc.new_state,
        "started_at": inc.started_at.isoformat() if inc.started_at else "",
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
        "created_at": inc.created_at.isoformat() if inc.created_at else "",
        "application_name": app_name,
        "host_name": host_name,
    }


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    db: DbSession,
    current_user: CurrentUser,
    application_id: UUID | None = Query(None),
    host_id: UUID | None = Query(None),
    status: str | None = Query(None),
    incident_type: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    incidents, total = await incident_service.list_incidents(
        db, application_id=application_id, host_id=host_id,
        status=status, incident_type=incident_type,
        offset=offset, limit=limit,
    )
    return {"items": [_serialize_incident(i) for i in incidents], "total": total}


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: UUID, db: DbSession, current_user: CurrentUser):
    inc = await incident_service.get_incident(db, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _serialize_incident(inc)
