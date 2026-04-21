from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import DbSession, CurrentUser
from app.models.incident import Incident
from app.models.application import Application

router = APIRouter()


@router.get("")
async def get_activity_feed(
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(20, ge=1, le=50),
):
    incidents_q = (
        select(Incident)
        .options()
        .order_by(Incident.started_at.desc())
        .limit(limit)
    )
    incidents_result = await db.execute(incidents_q)
    incidents = list(incidents_result.scalars().all())

    app_ids = {i.application_id for i in incidents if i.application_id}
    app_names: dict = {}
    if app_ids:
        apps_result = await db.execute(
            select(Application.id, Application.display_name)
            .where(Application.id.in_(app_ids))
        )
        app_names = {row[0]: row[1] for row in apps_result.all()}

    items = []
    for inc in incidents:
        items.append({
            "type": "incident",
            "id": str(inc.id),
            "timestamp": inc.started_at.isoformat() if inc.started_at else inc.created_at.isoformat(),
            "title": inc.title,
            "severity": inc.severity.value if hasattr(inc.severity, "value") else inc.severity,
            "status": inc.status.value if hasattr(inc.status, "value") else inc.status,
            "new_state": inc.new_state,
            "previous_state": inc.previous_state,
            "application_name": app_names.get(inc.application_id),
            "application_id": str(inc.application_id) if inc.application_id else None,
        })

    items.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"items": items[:limit]}
