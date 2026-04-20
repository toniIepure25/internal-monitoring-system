from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DbSession, CurrentUser
from app.schemas.group import (
    CreateGroupRequest, UpdateGroupRequest, AddApplicationToGroupRequest,
    GroupResponse, GroupListResponse, GroupApplicationResponse,
)
from app.services import group_service
from app.api.applications import _serialize_status

router = APIRouter()


def _serialize_group(group) -> dict:
    apps = []
    if hasattr(group, "group_applications") and group.group_applications:
        for ga in sorted(group.group_applications, key=lambda x: x.display_order):
            app = ga.application
            if app:
                apps.append({
                    "id": str(app.id),
                    "display_name": app.display_name,
                    "base_url": app.base_url,
                    "health_url": app.health_url,
                    "environment": app.environment,
                    "is_active": app.is_active,
                    "is_maintenance": app.is_maintenance,
                    "status": _serialize_status(app.status) if hasattr(app, "status") else None,
                    "display_order": ga.display_order,
                })

    return {
        "id": str(group.id),
        "name": group.name,
        "display_order": group.display_order,
        "color": group.color,
        "created_at": group.created_at.isoformat() if group.created_at else "",
        "applications": apps,
    }


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(req: CreateGroupRequest, db: DbSession, current_user: CurrentUser):
    group = await group_service.create_group(db, current_user.id, req.name, req.color)
    return _serialize_group(group)


@router.get("", response_model=GroupListResponse)
async def list_groups(db: DbSession, current_user: CurrentUser):
    groups = await group_service.list_user_groups(db, current_user.id)
    return {"items": [_serialize_group(g) for g in groups]}


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: UUID, req: UpdateGroupRequest, db: DbSession, current_user: CurrentUser,
):
    updates = req.model_dump(exclude_unset=True)
    group = await group_service.update_group(db, group_id, current_user.id, **updates)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return _serialize_group(group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: UUID, db: DbSession, current_user: CurrentUser):
    deleted = await group_service.delete_group(db, group_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Group not found")


@router.post("/{group_id}/applications", status_code=status.HTTP_201_CREATED)
async def add_app_to_group(
    group_id: UUID, req: AddApplicationToGroupRequest, db: DbSession, current_user: CurrentUser,
):
    try:
        ga = await group_service.add_application_to_group(
            db, group_id, current_user.id, UUID(req.application_id), req.display_order or 0,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return {"status": "added", "group_id": str(group_id), "application_id": req.application_id}


@router.delete("/{group_id}/applications/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_app_from_group(
    group_id: UUID, app_id: UUID, db: DbSession, current_user: CurrentUser,
):
    removed = await group_service.remove_application_from_group(
        db, group_id, current_user.id, app_id,
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Application not found in group")
