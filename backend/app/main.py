from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.utils.logging import setup_logging, get_logger

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting_up", monitoring_enabled=settings.MONITORING_ENABLED)

    if settings.MONITORING_ENABLED:
        from app.workers.scheduler import start_scheduler, stop_scheduler
        await start_scheduler()

    yield

    if settings.MONITORING_ENABLED:
        from app.workers.scheduler import stop_scheduler
        await stop_scheduler()

    logger.info("shutting_down")


app = FastAPI(
    title="Internal Monitoring System",
    description="Health endpoint monitoring platform with per-user subscriptions and notifications",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.auth import router as auth_router
from app.api.applications import router as applications_router
from app.api.subscriptions import router as subscriptions_router
from app.api.groups import router as groups_router
from app.api.incidents import router as incidents_router
from app.api.notifications import router as notifications_router
from app.api.admin import router as admin_router
from app.api.hosts import router as hosts_router
from app.api.public import router as public_router
from app.api.activity import router as activity_router

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(applications_router, prefix="/api/applications", tags=["applications"])
app.include_router(hosts_router, prefix="/api/hosts", tags=["hosts"])
app.include_router(subscriptions_router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(groups_router, prefix="/api/groups", tags=["groups"])
app.include_router(incidents_router, prefix="/api/incidents", tags=["incidents"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["notifications"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(public_router, prefix="/api/public", tags=["public"])
app.include_router(activity_router, prefix="/api/activity", tags=["activity"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "internal-monitoring-system"}
