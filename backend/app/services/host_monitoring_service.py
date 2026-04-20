"""Host monitoring service: heartbeat processing and missed-heartbeat detection.

The host state machine mirrors the application state machine pattern:
- Consecutive heartbeats required before ONLINE transition
- Consecutive misses required before OFFLINE transition
"""
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.host import Host, HostState
from app.models.host_status import HostStatus
from app.models.host_heartbeat import HostHeartbeat
from app.models.application_host import ApplicationHost
from app.services import incident_service, notification_service
from app.utils.logging import get_logger

logger = get_logger(__name__)

HEARTBEAT_RECOVERY_THRESHOLD = 2
HEARTBEAT_FAILURE_THRESHOLD = 3


async def process_heartbeat(
    db: AsyncSession,
    host: Host,
    ip_address: str | None = None,
    os_version: str | None = None,
    uptime_seconds: int | None = None,
    metadata: dict | None = None,
) -> dict:
    """Process an incoming heartbeat from a host agent."""
    now = datetime.now(timezone.utc)

    heartbeat = HostHeartbeat(
        host_id=host.id,
        received_at=now,
        ip_address=ip_address,
        os_version=os_version,
        uptime_seconds=uptime_seconds,
        metadata_json=metadata,
    )
    db.add(heartbeat)

    status = host.status
    if not status:
        status = HostStatus(host_id=host.id)
        db.add(status)
        await db.flush()

    old_state = status.status
    status.last_heartbeat_at = now
    status.consecutive_heartbeats += 1
    status.consecutive_misses = 0
    status.ip_address = ip_address
    status.os_version = os_version
    status.uptime_seconds = uptime_seconds
    status.updated_at = now

    new_state = old_state
    if old_state == HostState.UNKNOWN:
        if status.consecutive_heartbeats >= HEARTBEAT_RECOVERY_THRESHOLD:
            new_state = HostState.ONLINE
    elif old_state == HostState.OFFLINE:
        if status.consecutive_heartbeats >= HEARTBEAT_RECOVERY_THRESHOLD:
            new_state = HostState.ONLINE
    elif old_state == HostState.DEGRADED:
        if status.consecutive_heartbeats >= HEARTBEAT_RECOVERY_THRESHOLD:
            new_state = HostState.ONLINE

    if new_state != old_state:
        status.status = new_state
        logger.info(
            "host_state_transition",
            host_id=str(host.id),
            hostname=host.hostname,
            transition=f"{old_state.value}->{new_state.value}",
        )

        if new_state == HostState.ONLINE:
            await _resolve_host_incidents(db, host.id)

        inc = await _create_host_incident(
            db, host, old_state.value, new_state.value,
        )
        if inc:
            await _notify_host_subscribers(db, inc, host)
    else:
        status.status = new_state

    await db.flush()
    return {"status": "ok", "host_id": str(host.id), "host_state": new_state.value}


async def check_missed_heartbeats(db: AsyncSession):
    """Check all active hosts for missed heartbeats. Called by scheduler."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Host)
        .options(selectinload(Host.status))
        .where(Host.is_active == True)
    )
    hosts = list(result.scalars().all())

    for host in hosts:
        status = host.status
        if not status or not status.last_heartbeat_at:
            continue

        elapsed = (now - status.last_heartbeat_at).total_seconds()
        if elapsed <= host.heartbeat_timeout_seconds:
            continue

        old_state = status.status
        if old_state == HostState.OFFLINE:
            continue

        status.consecutive_misses += 1
        status.consecutive_heartbeats = 0
        status.updated_at = now

        if status.consecutive_misses >= HEARTBEAT_FAILURE_THRESHOLD:
            new_state = HostState.OFFLINE
            if new_state != old_state:
                status.status = new_state
                logger.info(
                    "host_state_transition",
                    host_id=str(host.id),
                    hostname=host.hostname,
                    transition=f"{old_state.value}->{new_state.value}",
                    missed_seconds=int(elapsed),
                )

                inc = await _create_host_incident(
                    db, host, old_state.value, new_state.value,
                )
                if inc:
                    await _notify_host_subscribers(db, inc, host)

    await db.flush()


async def _create_host_incident(
    db: AsyncSession, host: Host, previous_state: str, new_state: str,
):
    """Create a HOST-type incident for a host state transition."""
    from app.models.incident import Incident, IncidentSeverity

    if new_state == "OFFLINE":
        severity = IncidentSeverity.CRITICAL
        title = f"Host {host.display_name} is OFFLINE"
    elif new_state == "ONLINE":
        severity = IncidentSeverity.INFO
        title = f"Host {host.display_name} recovered (was {previous_state})"
    elif new_state == "DEGRADED":
        severity = IncidentSeverity.WARNING
        title = f"Host {host.display_name} is DEGRADED"
    else:
        severity = IncidentSeverity.INFO
        title = f"Host {host.display_name} state changed: {previous_state} -> {new_state}"

    incident = Incident(
        host_id=host.id,
        application_id=None,
        incident_type="HOST",
        title=title,
        severity=severity,
        previous_state=previous_state,
        new_state=new_state,
    )
    db.add(incident)
    await db.flush()

    logger.info(
        "host_incident_created",
        incident_id=str(incident.id),
        host_id=str(host.id),
        transition=f"{previous_state}->{new_state}",
        severity=severity.value,
    )
    return incident


async def _resolve_host_incidents(db: AsyncSession, host_id: UUID):
    """Resolve ongoing host incidents when host comes back online."""
    from app.models.incident import Incident, IncidentStatus

    result = await db.execute(
        select(Incident).where(
            Incident.host_id == host_id,
            Incident.incident_type == "HOST",
            Incident.status == IncidentStatus.ONGOING,
        )
    )
    incidents = list(result.scalars().all())
    now = datetime.now(timezone.utc)
    for inc in incidents:
        inc.status = IncidentStatus.RESOLVED
        inc.resolved_at = now
    await db.flush()


async def _notify_host_subscribers(db: AsyncSession, incident, host: Host):
    """Notify users subscribed to applications linked to this host."""
    from app.models.subscription import Subscription
    from app.models.notification_channel import NotificationChannel, ChannelType
    from app.models.notification_log import NotificationLog, DeliveryStatus

    app_hosts_result = await db.execute(
        select(ApplicationHost).where(ApplicationHost.host_id == host.id)
    )
    app_hosts = list(app_hosts_result.scalars().all())
    app_ids = [ah.application_id for ah in app_hosts]

    if not app_ids:
        return

    subs_result = await db.execute(
        select(Subscription).where(Subscription.application_id.in_(app_ids))
    )
    subscriptions = list(subs_result.scalars().all())

    notified_users = set()
    for sub in subscriptions:
        if sub.user_id in notified_users:
            continue
        if not sub.notify_on_down and incident.new_state == "OFFLINE":
            continue
        if not sub.notify_on_up and incident.new_state == "ONLINE":
            continue

        notified_users.add(sub.user_id)

        channels_result = await db.execute(
            select(NotificationChannel).where(
                NotificationChannel.user_id == sub.user_id,
                NotificationChannel.is_enabled == True,
            )
        )
        channels = list(channels_result.scalars().all())

        message = f"Host: {incident.title}"
        for channel in channels:
            log_entry = NotificationLog(
                user_id=sub.user_id,
                subscription_id=sub.id,
                incident_id=incident.id,
                channel_type=channel.channel_type,
                status=DeliveryStatus.PENDING,
            )
            db.add(log_entry)
            await db.flush()

            try:
                from app.integrations import telegram, email_sender, web_push
                if channel.channel_type == ChannelType.TELEGRAM:
                    await telegram.send_message(channel.config.get("chat_id", ""), message)
                elif channel.channel_type == ChannelType.EMAIL:
                    await email_sender.send_email(
                        channel.config.get("email", ""), f"Host Alert: {host.display_name}", message
                    )
                elif channel.channel_type == ChannelType.BROWSER_PUSH:
                    await web_push.send_push(
                        channel.config.get("subscription", {}), f"Host Alert: {host.display_name}", message
                    )
                log_entry.status = DeliveryStatus.SENT
                log_entry.sent_at = datetime.now(timezone.utc)
            except Exception as e:
                log_entry.status = DeliveryStatus.FAILED
                log_entry.error_message = str(e)[:1000]
                logger.warning("host_notification_failed", user_id=str(sub.user_id), error=str(e))

    await db.flush()
    logger.info("host_notifications_dispatched", incident_id=str(incident.id), user_count=len(notified_users))
