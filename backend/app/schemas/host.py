from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class CreateHostRequest(BaseModel):
    hostname: str = Field(min_length=1, max_length=255)
    display_name: str = Field(min_length=1, max_length=200)
    environment: Optional[str] = Field(None, max_length=50)
    tags: Optional[Dict[str, Any]] = None
    heartbeat_interval_seconds: int = Field(30, ge=10, le=600)
    heartbeat_timeout_seconds: int = Field(90, ge=30, le=1800)


class UpdateHostRequest(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    environment: Optional[str] = Field(None, max_length=50)
    tags: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    heartbeat_interval_seconds: Optional[int] = Field(None, ge=10, le=600)
    heartbeat_timeout_seconds: Optional[int] = Field(None, ge=30, le=1800)


class LinkApplicationRequest(BaseModel):
    application_id: str


class HeartbeatRequest(BaseModel):
    hostname: str
    os_version: Optional[str] = None
    uptime_seconds: Optional[int] = None
    ip_address: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class HostStatusResponse(BaseModel):
    status: str
    last_heartbeat_at: Optional[str] = None
    consecutive_misses: int = 0
    consecutive_heartbeats: int = 0
    ip_address: Optional[str] = None
    os_version: Optional[str] = None
    uptime_seconds: Optional[int] = None

    model_config = {"from_attributes": True}


class HostResponse(BaseModel):
    id: str
    hostname: str
    display_name: str
    environment: Optional[str] = None
    tags: Dict[str, Any] = {}
    os_info: Optional[str] = None
    is_active: bool
    heartbeat_interval_seconds: int
    heartbeat_timeout_seconds: int
    created_by: str
    created_at: str
    updated_at: str
    status: Optional[HostStatusResponse] = None
    api_key: Optional[str] = None

    model_config = {"from_attributes": True}


class HostDetailResponse(HostResponse):
    applications: List[dict] = []
    recent_heartbeats: List[dict] = []


class HostListResponse(BaseModel):
    items: List[HostResponse]
    total: int


class HeartbeatResponse(BaseModel):
    status: str
    host_id: str
    host_state: str
