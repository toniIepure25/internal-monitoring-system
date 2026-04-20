from pydantic import BaseModel
from typing import Optional, List


class CreateSubscriptionRequest(BaseModel):
    application_id: str
    notify_on_down: bool = True
    notify_on_up: bool = True
    notify_on_degraded: bool = False
    notify_on_slow: bool = False


class UpdateSubscriptionRequest(BaseModel):
    notify_on_down: Optional[bool] = None
    notify_on_up: Optional[bool] = None
    notify_on_degraded: Optional[bool] = None
    notify_on_slow: Optional[bool] = None


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    application_id: str
    notify_on_down: bool
    notify_on_up: bool
    notify_on_degraded: bool
    notify_on_slow: bool
    created_at: str
    application: Optional[dict] = None

    model_config = {"from_attributes": True}


class SubscriptionListResponse(BaseModel):
    items: List[SubscriptionResponse]
    total: int
