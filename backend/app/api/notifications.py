from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DbSession, CurrentUser
from app.schemas.notification import (
    CreateChannelRequest, UpdateChannelRequest, ChannelResponse,
    TestNotificationRequest, NotificationLogResponse, NotificationLogListResponse,
)
from app.services import notification_service

router = APIRouter()


def _serialize_channel(ch) -> dict:
    return {
        "id": str(ch.id),
        "channel_type": ch.channel_type.value if hasattr(ch.channel_type, "value") else ch.channel_type,
        "is_enabled": ch.is_enabled,
        "config": ch.config or {},
        "created_at": ch.created_at.isoformat() if ch.created_at else "",
        "updated_at": ch.updated_at.isoformat() if ch.updated_at else "",
    }


@router.get("/channels", response_model=list[ChannelResponse])
async def list_channels(db: DbSession, current_user: CurrentUser):
    channels = await notification_service.list_user_channels(db, current_user.id)
    return [_serialize_channel(c) for c in channels]


@router.post("/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_channel(
    req: CreateChannelRequest, db: DbSession, current_user: CurrentUser,
):
    try:
        ch = await notification_service.create_channel(
            db, current_user.id, req.channel_type, req.config, req.is_enabled,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _serialize_channel(ch)


@router.patch("/channels/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: UUID, req: UpdateChannelRequest, db: DbSession, current_user: CurrentUser,
):
    updates = req.model_dump(exclude_unset=True)
    ch = await notification_service.update_channel(db, channel_id, current_user.id, **updates)
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    return _serialize_channel(ch)


@router.post("/test")
async def test_notification(
    req: TestNotificationRequest, db: DbSession, current_user: CurrentUser,
):
    try:
        result = await notification_service.send_test_notification(
            db, current_user.id, UUID(req.channel_id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return result


@router.get("/log", response_model=NotificationLogListResponse)
async def list_notification_log(
    db: DbSession, current_user: CurrentUser,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    logs, total = await notification_service.list_notification_log(
        db, current_user.id, offset=offset, limit=limit,
    )
    items = [
        {
            "id": str(log.id),
            "user_id": str(log.user_id),
            "channel_type": log.channel_type.value if hasattr(log.channel_type, "value") else log.channel_type,
            "status": log.status.value if hasattr(log.status, "value") else log.status,
            "title": log.incident.title if getattr(log, "incident", None) else "Test notification",
            "application_name": (
                log.incident.application.display_name
                if getattr(log, "incident", None) and getattr(log.incident, "application", None)
                else None
            ),
            "host_name": (
                log.incident.host.display_name
                if getattr(log, "incident", None) and getattr(log.incident, "host", None)
                else None
            ),
            "error_message": log.error_message,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "created_at": log.created_at.isoformat() if log.created_at else "",
            "incident_id": str(log.incident_id) if log.incident_id else None,
        }
        for log in logs
    ]
    return {"items": items, "total": total}
