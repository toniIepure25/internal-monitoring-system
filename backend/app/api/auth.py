from fastapi import APIRouter, HTTPException, status

from app.api.deps import DbSession, CurrentUser
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse,
)
from app.services.auth_service import (
    register_user, authenticate_user, create_access_token,
    create_refresh_token, decode_refresh_token,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: DbSession):
    try:
        user = await register_user(db, req.email, req.password, req.display_name)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return _user_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: DbSession):
    user = await authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: DbSession):
    user_id = decode_refresh_token(req.refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    from uuid import UUID
    return TokenResponse(
        access_token=create_access_token(UUID(user_id)),
        refresh_token=create_refresh_token(UUID(user_id)),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    return _user_response(current_user)


def _user_response(user) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else "",
    }
