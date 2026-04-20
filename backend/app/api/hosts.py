from uuid import UUID

from fastapi import APIRouter, HTTPException, Header, Query, status

from app.api.deps import DbSession, CurrentUser
from app.schemas.host import (
    CreateHostRequest, UpdateHostRequest, LinkApplicationRequest,
    HeartbeatRequest, HostResponse, HostDetailResponse, HostListResponse,
    HeartbeatResponse,
)
from app.services import host_service, host_monitoring_service

router = APIRouter()


def _serialize_host_status(s) -> dict | None:
    if not s:
        return None
    return {
        "status": s.status.value if hasattr(s.status, "value") else s.status,
        "last_heartbeat_at": s.last_heartbeat_at.isoformat() if s.last_heartbeat_at else None,
        "consecutive_misses": s.consecutive_misses,
        "consecutive_heartbeats": s.consecutive_heartbeats,
        "ip_address": s.ip_address,
        "os_version": s.os_version,
        "uptime_seconds": s.uptime_seconds,
    }


def _serialize_host(host, include_api_key: bool = False) -> dict:
    data = {
        "id": str(host.id),
        "hostname": host.hostname,
        "display_name": host.display_name,
        "environment": host.environment,
        "tags": host.tags or {},
        "os_info": host.os_info,
        "is_active": host.is_active,
        "heartbeat_interval_seconds": host.heartbeat_interval_seconds,
        "heartbeat_timeout_seconds": host.heartbeat_timeout_seconds,
        "created_by": str(host.created_by),
        "created_at": host.created_at.isoformat() if host.created_at else "",
        "updated_at": host.updated_at.isoformat() if host.updated_at else "",
        "status": _serialize_host_status(host.status) if hasattr(host, "status") else None,
    }
    if include_api_key:
        data["api_key"] = host.api_key
    return data


@router.post("", response_model=HostResponse, status_code=status.HTTP_201_CREATED)
async def create_host(req: CreateHostRequest, db: DbSession, current_user: CurrentUser):
    try:
        host = await host_service.create_host(
            db,
            hostname=req.hostname,
            display_name=req.display_name,
            created_by=current_user.id,
            environment=req.environment,
            tags=req.tags,
            heartbeat_interval_seconds=req.heartbeat_interval_seconds,
            heartbeat_timeout_seconds=req.heartbeat_timeout_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return _serialize_host(host, include_api_key=True)


@router.get("", response_model=HostListResponse)
async def list_hosts(
    db: DbSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    environment: str | None = Query(None),
    is_active: bool | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    hosts, total = await host_service.list_hosts(
        db, search=search, environment=environment, is_active=is_active,
        offset=offset, limit=limit,
    )
    return {"items": [_serialize_host(h) for h in hosts], "total": total}


@router.get("/{host_id}", response_model=HostDetailResponse)
async def get_host(host_id: UUID, db: DbSession, current_user: CurrentUser):
    host = await host_service.get_host(db, host_id)
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    data = _serialize_host(host)
    data["applications"] = [
        {
            "id": str(ah.application.id),
            "display_name": ah.application.display_name,
            "base_url": ah.application.base_url,
            "health_url": ah.application.health_url,
            "environment": ah.application.environment,
            "is_active": ah.application.is_active,
        }
        for ah in (host.application_hosts or [])
        if ah.application
    ]

    heartbeats = await host_service.get_recent_heartbeats(db, host_id, limit=20)
    data["recent_heartbeats"] = [
        {
            "id": str(hb.id),
            "received_at": hb.received_at.isoformat() if hb.received_at else None,
            "ip_address": hb.ip_address,
            "os_version": hb.os_version,
            "uptime_seconds": hb.uptime_seconds,
        }
        for hb in heartbeats
    ]
    return data


@router.patch("/{host_id}", response_model=HostResponse)
async def update_host(host_id: UUID, req: UpdateHostRequest, db: DbSession, current_user: CurrentUser):
    updates = req.model_dump(exclude_unset=True)
    host = await host_service.update_host(db, host_id, **updates)
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")
    return _serialize_host(host)


@router.post("/{host_id}/regenerate-key")
async def regenerate_key(host_id: UUID, db: DbSession, current_user: CurrentUser):
    new_key = await host_service.regenerate_api_key(db, host_id)
    if not new_key:
        raise HTTPException(status_code=404, detail="Host not found")
    return {"api_key": new_key}


@router.post("/{host_id}/applications", status_code=status.HTTP_201_CREATED)
async def link_application(host_id: UUID, req: LinkApplicationRequest, db: DbSession, current_user: CurrentUser):
    try:
        binding = await host_service.link_application(db, host_id, UUID(req.application_id))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return {"status": "linked", "host_id": str(host_id), "application_id": req.application_id}


@router.delete("/{host_id}/applications/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_application(host_id: UUID, app_id: UUID, db: DbSession, current_user: CurrentUser):
    deleted = await host_service.unlink_application(db, host_id, app_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Binding not found")


@router.post("/heartbeat", response_model=HeartbeatResponse)
async def receive_heartbeat(
    req: HeartbeatRequest,
    db: DbSession,
    x_host_api_key: str = Header(...),
):
    """Heartbeat endpoint authenticated by X-Host-API-Key header."""
    host = await host_service.get_host_by_api_key(db, x_host_api_key)
    if not host:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    if not host.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Host is deactivated")

    result = await host_monitoring_service.process_heartbeat(
        db,
        host=host,
        ip_address=req.ip_address,
        os_version=req.os_version,
        uptime_seconds=req.uptime_seconds,
        metadata=req.metadata,
    )
    return result
