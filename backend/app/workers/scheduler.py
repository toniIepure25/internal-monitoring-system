"""APScheduler-based monitoring scheduler.

Loads active applications from DB and creates interval jobs for each.
Supports dynamic add/remove of jobs when apps are created or disabled.
"""
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.workers.monitoring_worker import check_application, check_hosts, get_active_applications
from app.utils.logging import get_logger

logger = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def start_scheduler():
    global _scheduler
    _scheduler = AsyncIOScheduler(
        job_defaults={"coalesce": True, "max_instances": 1, "misfire_grace_time": 30},
    )

    apps = await get_active_applications()
    for app in apps:
        _scheduler.add_job(
            check_application,
            trigger=IntervalTrigger(seconds=app["interval"]),
            id=f"monitor_{app['id']}",
            args=[app["id"]],
            replace_existing=True,
            name=f"Monitor: {app['display_name']}",
        )

    _scheduler.add_job(
        check_hosts,
        trigger=IntervalTrigger(seconds=30),
        id="check_hosts",
        replace_existing=True,
        name="Check host heartbeats",
    )

    _scheduler.start()
    logger.info("scheduler_started", job_count=len(apps) + 1)


async def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("scheduler_stopped")


def add_monitoring_job(app_id: str, display_name: str, interval_seconds: int):
    """Add or update a monitoring job for an application."""
    if not _scheduler:
        return

    _scheduler.add_job(
        check_application,
        trigger=IntervalTrigger(seconds=interval_seconds),
        id=f"monitor_{app_id}",
        args=[app_id],
        replace_existing=True,
        name=f"Monitor: {display_name}",
    )
    logger.info("job_added", app_id=app_id, interval=interval_seconds)


def remove_monitoring_job(app_id: str):
    """Remove monitoring job for an application."""
    if not _scheduler:
        return

    job_id = f"monitor_{app_id}"
    try:
        _scheduler.remove_job(job_id)
        logger.info("job_removed", app_id=app_id)
    except Exception:
        pass


def refresh_monitoring_job_for_application(
    app_id: str,
    display_name: str,
    health_url: str | None,
    is_active: bool,
    is_maintenance: bool,
    interval_seconds: int,
) -> None:
    """Add or remove APScheduler job when app config changes (call after DB commit)."""
    if not health_url or not is_active or is_maintenance:
        remove_monitoring_job(app_id)
        return
    add_monitoring_job(app_id, display_name, interval_seconds)


def get_scheduler_status() -> dict:
    """Get current scheduler status."""
    if not _scheduler:
        return {"running": False, "jobs": 0}

    jobs = _scheduler.get_jobs()
    return {
        "running": _scheduler.running,
        "jobs": len(jobs),
        "job_details": [
            {"id": j.id, "name": j.name, "next_run": str(j.next_run_time)}
            for j in jobs
        ],
    }
