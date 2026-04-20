from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DbSession, CurrentUser
from app.schemas.subscription import (
    CreateSubscriptionRequest, UpdateSubscriptionRequest,
    SubscriptionResponse, SubscriptionListResponse,
)
from app.services import subscription_service
from app.api.applications import _serialize_app, _serialize_status

router = APIRouter()


def _serialize_subscription(sub) -> dict:
    data = {
        "id": str(sub.id),
        "user_id": str(sub.user_id),
        "application_id": str(sub.application_id),
        "notify_on_down": sub.notify_on_down,
        "notify_on_up": sub.notify_on_up,
        "notify_on_degraded": sub.notify_on_degraded,
        "notify_on_slow": sub.notify_on_slow,
        "created_at": sub.created_at.isoformat() if sub.created_at else "",
        "application": None,
    }
    if hasattr(sub, "application") and sub.application:
        data["application"] = _serialize_app(sub.application)
    return data


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    req: CreateSubscriptionRequest, db: DbSession, current_user: CurrentUser,
):
    try:
        sub = await subscription_service.create_subscription(
            db, current_user.id, UUID(req.application_id),
            notify_on_down=req.notify_on_down,
            notify_on_up=req.notify_on_up,
            notify_on_degraded=req.notify_on_degraded,
            notify_on_slow=req.notify_on_slow,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return _serialize_subscription(sub)


@router.get("", response_model=SubscriptionListResponse)
async def list_subscriptions(
    db: DbSession, current_user: CurrentUser,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    subs, total = await subscription_service.list_user_subscriptions(
        db, current_user.id, offset=offset, limit=limit,
    )
    return {"items": [_serialize_subscription(s) for s in subs], "total": total}


@router.patch("/{sub_id}", response_model=SubscriptionResponse)
async def update_subscription(
    sub_id: UUID, req: UpdateSubscriptionRequest, db: DbSession, current_user: CurrentUser,
):
    updates = req.model_dump(exclude_unset=True)
    sub = await subscription_service.update_subscription(db, sub_id, current_user.id, **updates)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return _serialize_subscription(sub)


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription(sub_id: UUID, db: DbSession, current_user: CurrentUser):
    deleted = await subscription_service.delete_subscription(db, sub_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Subscription not found")
