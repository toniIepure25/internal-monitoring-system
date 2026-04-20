from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List


class CreateApplicationRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=200)
    base_url: str = Field(min_length=1, max_length=2048)
    health_url: Optional[str] = None
    environment: Optional[str] = Field(None, max_length=50)
    monitoring_interval_seconds: Optional[int] = Field(None, ge=10, le=3600)


class UpdateApplicationRequest(BaseModel):
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    environment: Optional[str] = Field(None, max_length=50)
    monitoring_interval_seconds: Optional[int] = Field(None, ge=10, le=3600)
    timeout_seconds: Optional[int] = Field(None, ge=1, le=60)
    consecutive_failures_threshold: Optional[int] = Field(None, ge=1, le=20)
    consecutive_recovery_threshold: Optional[int] = Field(None, ge=1, le=10)
    slow_threshold_ms: Optional[int] = Field(None, ge=100, le=30000)


class SetHealthUrlRequest(BaseModel):
    health_url: str = Field(min_length=1, max_length=2048)


class HealthCandidateResponse(BaseModel):
    id: str
    url: str
    http_status: Optional[int]
    response_time_ms: Optional[int]
    is_json: bool
    has_health_indicators: bool
    score: float
    is_selected: bool
    probed_at: Optional[str]

    model_config = {"from_attributes": True}


class ApplicationStatusResponse(BaseModel):
    status: str
    last_checked_at: Optional[str]
    last_response_time_ms: Optional[int]
    last_http_status: Optional[int]
    consecutive_failures: int
    consecutive_successes: int

    model_config = {"from_attributes": True}


class ApplicationResponse(BaseModel):
    id: str
    display_name: str
    base_url: str
    normalized_url: str
    health_url: Optional[str]
    detection_source: str
    environment: Optional[str]
    is_active: bool
    is_maintenance: bool
    created_by: str
    monitoring_interval_seconds: int
    timeout_seconds: int
    consecutive_failures_threshold: int
    consecutive_recovery_threshold: int
    slow_threshold_ms: int
    created_at: str
    updated_at: str
    status: Optional[ApplicationStatusResponse] = None

    model_config = {"from_attributes": True}


class ApplicationDetailResponse(ApplicationResponse):
    health_candidates: List[HealthCandidateResponse] = []


class ApplicationListResponse(BaseModel):
    items: List[ApplicationResponse]
    total: int
