from pydantic import BaseModel, Field
from typing import Optional, List


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class UpdateGroupRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    display_order: Optional[int] = None
    color: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class AddApplicationToGroupRequest(BaseModel):
    application_id: str
    display_order: Optional[int] = 0


class GroupApplicationResponse(BaseModel):
    id: str
    display_name: str
    base_url: str
    health_url: Optional[str]
    environment: Optional[str]
    is_active: bool
    is_maintenance: bool
    status: Optional[dict] = None
    display_order: int = 0

    model_config = {"from_attributes": True}


class GroupResponse(BaseModel):
    id: str
    name: str
    display_order: int
    color: Optional[str]
    created_at: str
    applications: List[GroupApplicationResponse] = []

    model_config = {"from_attributes": True}


class GroupListResponse(BaseModel):
    items: List[GroupResponse]
