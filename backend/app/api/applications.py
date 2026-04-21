import asyncio
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, status

from app.api.deps import DbSession, CurrentUser
from app.schemas.application import (
    CreateApplicationRequest, UpdateApplicationRequest, SetHealthUrlRequest,
    ApplicationResponse, ApplicationDetailResponse, ApplicationListResponse,
    ApplicationStatusResponse, HealthCandidateResponse,
)
from app.services import application_service, discovery_service
from app.database import async_session_factory
from app.workers.scheduler import refresh_monitoring_job_for_application, remove_monitoring_job
from app.services.monitoring_service import run_check_for_application

router = APIRouter()


def _serialize_status(s) -> dict | None:
    if not s:
        return None
    return {
        "status": s.status.value if hasattr(s.status, "value") else s.status,
        "last_checked_at": s.last_checked_at.isoformat() if s.last_checked_at else None,
        "last_response_time_ms": s.last_response_time_ms,
        "last_http_status": s.last_http_status,
        "consecutive_failures": s.consecutive_failures,
        "consecutive_successes": s.consecutive_successes,
    }


def _serialize_app(app) -> dict:
    return {
        "id": str(app.id),
        "display_name": app.display_name,
        "base_url": app.base_url,
        "normalized_url": app.normalized_url,
        "health_url": app.health_url,
        "detection_source": app.detection_source.value if hasattr(app.detection_source, "value") else app.detection_source,
        "environment": app.environment,
        "is_active": app.is_active,
        "is_maintenance": app.is_maintenance,
        "created_by": str(app.created_by),
        "monitoring_interval_seconds": app.monitoring_interval_seconds,
        "timeout_seconds": app.timeout_seconds,
        "consecutive_failures_threshold": app.consecutive_failures_threshold,
        "consecutive_recovery_threshold": app.consecutive_recovery_threshold,
        "slow_threshold_ms": app.slow_threshold_ms,
        "created_at": app.created_at.isoformat() if app.created_at else "",
        "updated_at": app.updated_at.isoformat() if app.updated_at else "",
        "status": _serialize_status(app.status) if hasattr(app, "status") else None,
    }


async def _run_discovery_background(app_id: str, base_url: str):
    """Run discovery in background with its own DB session."""
    async with async_session_factory() as db:
        try:
            await discovery_service.discover_health_endpoints(db, UUID(app_id), base_url)
            await run_check_for_application(db, UUID(app_id))
            await db.commit()
            app = await application_service.get_application(db, UUID(app_id))
            if app:
                refresh_monitoring_job_for_application(
                    str(app.id),
                    app.display_name,
                    app.health_url,
                    app.is_active,
                    app.is_maintenance,
                    app.monitoring_interval_seconds,
                )
        except Exception as e:
            await db.rollback()
            from app.utils.logging import get_logger
            get_logger(__name__).error("background_discovery_failed", app_id=app_id, error=str(e))


async def _run_initial_check_background(app_id: str):
    async with async_session_factory() as db:
        try:
            await run_check_for_application(db, UUID(app_id))
            await db.commit()
        except Exception as e:
            await db.rollback()
            from app.utils.logging import get_logger
            get_logger(__name__).error("initial_check_failed", app_id=app_id, error=str(e))


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    req: CreateApplicationRequest,
    db: DbSession,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
):
    try:
        app = await application_service.create_application(
            db,
            display_name=req.display_name,
            base_url=req.base_url,
            created_by=current_user.id,
            health_url=req.health_url,
            environment=req.environment,
            monitoring_interval_seconds=req.monitoring_interval_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    if not req.health_url:
        background_tasks.add_task(_run_discovery_background, str(app.id), req.base_url)
    else:
        refresh_monitoring_job_for_application(
            str(app.id),
            app.display_name,
            app.health_url,
            app.is_active,
            app.is_maintenance,
            app.monitoring_interval_seconds,
        )
        background_tasks.add_task(_run_initial_check_background, str(app.id))

    return _serialize_app(app)


@router.get("", response_model=ApplicationListResponse)
async def list_applications(
    db: DbSession,
    current_user: CurrentUser,
    search: str | None = Query(None),
    environment: str | None = Query(None),
    is_active: bool | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    apps, total = await application_service.list_applications(
        db, search=search, environment=environment, is_active=is_active,
        offset=offset, limit=limit,
    )
    return {"items": [_serialize_app(a) for a in apps], "total": total}


@router.get("/{app_id}", response_model=ApplicationDetailResponse)
async def get_application(app_id: UUID, db: DbSession, current_user: CurrentUser):
    app = await application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    data = _serialize_app(app)
    data["health_candidates"] = [
        {
            "id": str(c.id),
            "url": c.url,
            "http_status": c.http_status,
            "response_time_ms": c.response_time_ms,
            "is_json": c.is_json,
            "has_health_indicators": c.has_health_indicators,
            "score": c.score,
            "is_selected": c.is_selected,
            "probed_at": c.probed_at.isoformat() if c.probed_at else None,
        }
        for c in (app.health_candidates or [])
    ]
    return data


@router.patch("/{app_id}", response_model=ApplicationResponse)
async def update_application(
    app_id: UUID, req: UpdateApplicationRequest, db: DbSession, current_user: CurrentUser,
):
    updates = req.model_dump(exclude_unset=True)
    app = await application_service.update_application(db, app_id, **updates)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    refresh_monitoring_job_for_application(
        str(app.id),
        app.display_name,
        app.health_url,
        app.is_active,
        app.is_maintenance,
        app.monitoring_interval_seconds,
    )
    return _serialize_app(app)


@router.patch("/{app_id}/health-url", response_model=ApplicationResponse)
async def set_health_url(
    app_id: UUID, req: SetHealthUrlRequest, db: DbSession, current_user: CurrentUser,
):
    app = await application_service.set_health_url(db, app_id, req.health_url)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    refresh_monitoring_job_for_application(
        str(app.id),
        app.display_name,
        app.health_url,
        app.is_active,
        app.is_maintenance,
        app.monitoring_interval_seconds,
    )
    return _serialize_app(app)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(app_id: UUID, db: DbSession, current_user: CurrentUser):
    deleted = await application_service.delete_application(db, app_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Application not found")
    remove_monitoring_job(str(app_id))


@router.get("/{app_id}/health-history")
async def get_health_history(
    app_id: UUID, db: DbSession, current_user: CurrentUser,
    limit: int = Query(30, ge=1, le=100),
):
    checks = await application_service.get_health_history(db, app_id, limit=limit)
    return {
        "items": [
            {
                "id": str(c.id),
                "status": c.status.value if hasattr(c.status, "value") else c.status,
                "http_status": c.http_status,
                "response_time_ms": c.response_time_ms,
                "error_message": c.error_message,
                "checked_at": c.checked_at.isoformat() if c.checked_at else None,
            }
            for c in checks
        ]
    }


@router.post("/{app_id}/rediscover", status_code=status.HTTP_202_ACCEPTED)
async def rediscover(
    app_id: UUID, db: DbSession, current_user: CurrentUser, background_tasks: BackgroundTasks,
):
    app = await application_service.get_application(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    background_tasks.add_task(_run_discovery_background, str(app.id), app.base_url)
    return {"status": "discovery_started", "application_id": str(app_id)}
