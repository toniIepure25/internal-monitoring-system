from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class CreateChannelRequest(BaseModel):
    channel_type: str
    config: Dict[str, Any] = {}
    is_enabled: bool = True


class UpdateChannelRequest(BaseModel):
    is_enabled: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None


class ChannelResponse(BaseModel):
    id: str
    channel_type: str
    is_enabled: bool
    config: Dict[str, Any]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class TestNotificationRequest(BaseModel):
    channel_id: str


class NotificationLogResponse(BaseModel):
    id: str
    user_id: str
    channel_type: str
    status: str
    title: Optional[str] = None
    application_name: Optional[str] = None
    host_name: Optional[str] = None
    error_message: Optional[str]
    sent_at: Optional[str]
    created_at: str
    incident_id: Optional[str] = None

    model_config = {"from_attributes": True}


class NotificationLogListResponse(BaseModel):
    items: List[NotificationLogResponse]
    total: int
