"""Monitoring service: health check execution and state machine.

The state machine prevents false positives by requiring consecutive failures
before marking an app DOWN, and consecutive successes before marking it UP again.
"""
import time
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.application import Application
from app.models.application_status import ApplicationStatus, AppState
from app.models.health_check import HealthCheck
from app.models.application_host import ApplicationHost
from app.models.host import Host, HostState
from app.models.host_status import HostStatus
from app.services import incident_service, notification_service
from app.utils.logging import get_logger

logger = get_logger(__name__)


class CheckResult:
    __slots__ = ("success", "http_status", "response_time_ms", "error", "is_slow", "is_degraded")

    def __init__(
        self,
        success: bool,
        http_status: int | None = None,
        response_time_ms: int | None = None,
        error: str | None = None,
        is_slow: bool = False,
        is_degraded: bool = False,
    ):
        self.success = success
        self.http_status = http_status
        self.response_time_ms = response_time_ms
        self.error = error
        self.is_slow = is_slow
        self.is_degraded = is_degraded


async def execute_health_check(
    health_url: str, timeout_seconds: int, slow_threshold_ms: int,
) -> CheckResult:
    """Execute a single health check against the given URL."""
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(verify=False) as client:
            resp = await client.get(
                health_url,
                follow_redirects=True,
                timeout=timeout_seconds,
                headers={"User-Agent": "InternalMonitor/1.0"},
            )
        elapsed_ms = int((time.monotonic() - start) * 1000)

        is_success = 200 <= resp.status_code < 500
        is_slow = elapsed_ms > slow_threshold_ms

        # Check for degraded state from response body
        is_degraded = False
        if is_success and resp.headers.get("content-type", "").startswith("application/json"):
            try:
                body = resp.json()
                if isinstance(body, dict):
                    status_val = str(body.get("status", "")).lower()
                    if status_val in ("degraded", "warning", "partial"):
                        is_degraded = True
            except Exception:
                pass

        return CheckResult(
            success=is_success and resp.status_code < 300,
            http_status=resp.status_code,
            response_time_ms=elapsed_ms,
            is_slow=is_slow,
            is_degraded=is_degraded,
        )
    except Exception as e:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return CheckResult(
            success=False,
            response_time_ms=elapsed_ms,
            error=str(e)[:500],
        )


def evaluate_transition(
    current_state: AppState,
    check: CheckResult,
    consecutive_failures: int,
    consecutive_successes: int,
    failures_threshold: int,
    recovery_threshold: int,
) -> tuple[AppState, int, int]:
    """Evaluate state machine transition.

    Returns (new_state, new_consecutive_failures, new_consecutive_successes).
    """
    if check.success:
        new_failures = 0
        new_successes = consecutive_successes + 1
    else:
        new_failures = consecutive_failures + 1
        new_successes = 0

    new_state = current_state

    if check.success:
        if check.is_degraded:
            if current_state != AppState.DEGRADED:
                new_state = AppState.DEGRADED
        elif check.is_slow:
            if current_state != AppState.SLOW:
                new_state = AppState.SLOW
        else:
            # Healthy response
            if current_state == AppState.UNKNOWN:
                new_state = AppState.UP
            elif current_state in (AppState.DOWN, AppState.DEGRADED, AppState.SLOW):
                if new_successes >= recovery_threshold:
                    new_state = AppState.UP
            # Already UP stays UP
    else:
        # Failed check
        if current_state == AppState.UNKNOWN:
            if new_failures >= failures_threshold:
                new_state = AppState.DOWN
        elif current_state in (AppState.UP, AppState.SLOW, AppState.DEGRADED):
            if new_failures >= failures_threshold:
                new_state = AppState.DOWN
        # Already DOWN stays DOWN

    return new_state, new_failures, new_successes


async def run_check_for_application(db: AsyncSession, application_id: UUID):
    """Execute health check for a single application and process results."""
    result = await db.execute(
        select(Application)
        .options(selectinload(Application.status))
        .where(Application.id == application_id)
    )
    app = result.scalar_one_or_none()
    if not app or not app.is_active or app.is_maintenance or not app.health_url:
        return

    check = await execute_health_check(
        app.health_url, app.timeout_seconds, app.slow_threshold_ms,
    )

    # Determine check status for log
    if check.success:
        if check.is_degraded:
            check_status = AppState.DEGRADED
        elif check.is_slow:
            check_status = AppState.SLOW
        else:
            check_status = AppState.UP
    else:
        check_status = AppState.DOWN

    health_log = HealthCheck(
        application_id=application_id,
        status=check_status,
        http_status=check.http_status,
        response_time_ms=check.response_time_ms,
        error_message=check.error,
    )
    db.add(health_log)

    status = app.status
    if not status:
        status = ApplicationStatus(application_id=application_id)
        db.add(status)
        await db.flush()

    old_state = status.status

    new_state, new_failures, new_successes = evaluate_transition(
        current_state=old_state,
        check=check,
        consecutive_failures=status.consecutive_failures,
        consecutive_successes=status.consecutive_successes,
        failures_threshold=app.consecutive_failures_threshold,
        recovery_threshold=app.consecutive_recovery_threshold,
    )

    status.status = new_state
    status.consecutive_failures = new_failures
    status.consecutive_successes = new_successes
    status.last_checked_at = datetime.now(timezone.utc)
    status.last_response_time_ms = check.response_time_ms
    status.last_http_status = check.http_status

    await db.flush()

    # Handle state transitions
    if new_state != old_state:
        # Check if any linked host is OFFLINE for HOST_CAUSED classification
        incident_type = "APPLICATION"
        host_id_for_incident = None
        if new_state == AppState.DOWN:
            host_id_for_incident, incident_type = await _check_host_caused(db, application_id)

        logger.info(
            "state_transition",
            app_id=str(application_id),
            app_name=app.display_name,
            transition=f"{old_state.value}->{new_state.value}",
            incident_type=incident_type,
        )

        if new_state == AppState.UP:
            await incident_service.resolve_ongoing_incidents(db, application_id)

        inc = await incident_service.create_incident(
            db, application_id, old_state.value, new_state.value, app.display_name,
            incident_type=incident_type,
            host_id=host_id_for_incident,
        )

        try:
            await notification_service.dispatch_incident_notifications(
                db, inc, app.display_name,
            )
        except Exception as e:
            logger.error("notification_dispatch_error", error=str(e))

    await db.flush()


async def _check_host_caused(db: AsyncSession, application_id: UUID) -> tuple[UUID | None, str]:
    """Check if any host linked to this application is OFFLINE."""
    result = await db.execute(
        select(ApplicationHost).where(ApplicationHost.application_id == application_id)
    )
    bindings = list(result.scalars().all())
    if not bindings:
        return None, "APPLICATION"

    for binding in bindings:
        status_result = await db.execute(
            select(HostStatus).where(HostStatus.host_id == binding.host_id)
        )
        host_status = status_result.scalar_one_or_none()
        if host_status and host_status.status == HostState.OFFLINE:
            return binding.host_id, "HOST_CAUSED"

    return None, "APPLICATION"
