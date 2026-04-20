from uuid import UUID
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession, AdminUser
from app.models.user import User
from app.models.application import Application
from app.models.application_status import ApplicationStatus
from app.models.host import Host
from app.models.host_status import HostStatus, HostState
from app.models.incident import Incident, IncidentStatus
from app.services import application_service
from app.api.applications import _serialize_app
from app.workers.scheduler import refresh_monitoring_job_for_application

router = APIRouter()


@router.get("/applications")
async def admin_list_applications(
    db: DbSession, admin: AdminUser,
    search: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    apps, total = await application_service.list_applications(
        db, search=search, offset=offset, limit=limit,
    )
    return {"items": [_serialize_app(a) for a in apps], "total": total}


@router.patch("/applications/{app_id}")
async def admin_update_application(
    app_id: UUID, db: DbSession, admin: AdminUser,
    display_name: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_maintenance: Optional[bool] = None,
    environment: Optional[str] = None,
    monitoring_interval_seconds: Optional[int] = None,
):
    updates = {}
    if display_name is not None:
        updates["display_name"] = display_name
    if is_active is not None:
        updates["is_active"] = is_active
    if is_maintenance is not None:
        updates["is_maintenance"] = is_maintenance
    if environment is not None:
        updates["environment"] = environment
    if monitoring_interval_seconds is not None:
        updates["monitoring_interval_seconds"] = monitoring_interval_seconds

    app = await application_service.update_application(db, app_id, **updates)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    refresh_monitoring_job_for_application(
        str(app.id),
        app.display_name,
        app.health_url,
        app.is_active,
        app.is_maintenance,
        app.monitoring_interval_seconds,
    )
    return _serialize_app(app)


@router.get("/users")
async def admin_list_users(
    db: DbSession, admin: AdminUser,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    query = select(User).order_by(User.created_at.desc()).offset(offset).limit(limit)
    count_query = select(func.count(User.id))

    result = await db.execute(query)
    total_result = await db.execute(count_query)

    users = result.scalars().all()
    return {
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "display_name": u.display_name,
                "role": u.role.value if hasattr(u.role, "value") else u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else "",
            }
            for u in users
        ],
        "total": total_result.scalar_one(),
    }


@router.get("/system")
async def admin_system_status(db: DbSession, admin: AdminUser):
    app_count = await db.execute(select(func.count(Application.id)))
    user_count = await db.execute(select(func.count(User.id)))
    host_count = await db.execute(select(func.count(Host.id)))
    hosts_online = await db.execute(
        select(func.count(HostStatus.id)).where(HostStatus.status == HostState.ONLINE)
    )
    active_incidents = await db.execute(
        select(func.count(Incident.id)).where(Incident.status == IncidentStatus.ONGOING)
    )

    return {
        "total_applications": app_count.scalar_one(),
        "total_users": user_count.scalar_one(),
        "total_hosts": host_count.scalar_one(),
        "hosts_online": hosts_online.scalar_one(),
        "active_incidents": active_incidents.scalar_one(),
        "status": "operational",
    }
