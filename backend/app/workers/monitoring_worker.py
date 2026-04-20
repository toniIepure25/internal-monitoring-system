"""Monitoring worker: periodic health check execution for all active applications and hosts."""
from uuid import UUID

from sqlalchemy import select

from app.database import async_session_factory
from app.models.application import Application
from app.services.monitoring_service import run_check_for_application
from app.services.host_monitoring_service import check_missed_heartbeats
from app.utils.logging import get_logger

logger = get_logger(__name__)


async def check_application(app_id: str):
    """Run health check for a single application. Called by the scheduler."""
    async with async_session_factory() as db:
        try:
            await run_check_for_application(db, UUID(app_id))
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error("check_failed", app_id=app_id, error=str(e))


async def check_hosts():
    """Check all hosts for missed heartbeats. Called by the scheduler."""
    async with async_session_factory() as db:
        try:
            await check_missed_heartbeats(db)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error("host_check_failed", error=str(e))


async def get_active_applications() -> list[dict]:
    """Load all active, non-maintenance applications with health URLs."""
    async with async_session_factory() as db:
        result = await db.execute(
            select(Application).where(
                Application.is_active == True,
                Application.is_maintenance == False,
                Application.health_url.isnot(None),
            )
        )
        apps = result.scalars().all()
        return [
            {
                "id": str(a.id),
                "display_name": a.display_name,
                "interval": a.monitoring_interval_seconds,
            }
            for a in apps
        ]
