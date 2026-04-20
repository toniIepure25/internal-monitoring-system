from pydantic import BaseModel
from typing import Optional, List


class IncidentResponse(BaseModel):
    id: str
    application_id: Optional[str] = None
    host_id: Optional[str] = None
    incident_type: str = "APPLICATION"
    title: str
    status: str
    severity: str
    previous_state: str
    new_state: str
    started_at: str
    resolved_at: Optional[str] = None
    created_at: str
    application_name: Optional[str] = None
    host_name: Optional[str] = None

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
