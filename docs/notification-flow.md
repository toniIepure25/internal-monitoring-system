# Notification Flow

## Overview

Notifications are triggered by state transitions in the monitoring engine for both **applications** and **hosts**. They are never sent for repeated checks that produce the same state -- only when an entity transitions between states (e.g., UP -> DOWN for apps, ONLINE -> OFFLINE for hosts).

## Application Transition Detection

The state machine in `monitoring_service.py` evaluates each health check result against the current state and threshold configuration:

1. **Consecutive Failures Threshold** (default: 3): An application must fail N consecutive checks before being marked DOWN.

2. **Recovery Threshold** (default: 2): An application must succeed N consecutive checks before being marked UP again.

3. **Slow Threshold** (default: 2000ms): Response times above this value trigger a SLOW state.

## Host Transition Detection

The host state machine in `host_monitoring_service.py` evaluates heartbeat arrivals and missed heartbeats:

1. **Heartbeat Recovery Threshold** (default: 2): A host must send N consecutive heartbeats before transitioning to ONLINE.

2. **Heartbeat Failure Threshold** (default: 3): A host must miss N consecutive heartbeat windows before transitioning to OFFLINE.

3. **Heartbeat Timeout**: Configured per-host (default 90s = 3x the 30s interval). If the last heartbeat is older than this, a miss is recorded.

## Incident Type Classification

| Scenario | Incident Type | Description |
|----------|---------------|-------------|
| App health check fails, host is ONLINE | APPLICATION | Standard application failure |
| App health check fails, linked host is OFFLINE | HOST_CAUSED | Application down due to host issue |
| Host misses heartbeat threshold | HOST | Host-level incident |

## Dispatch Process

When a state transition is detected:

1. **Incident Created**: A new `Incident` record with `incident_type` (APPLICATION, HOST, or HOST_CAUSED), and optional `host_id`.

2. **Subscribers Queried**:
   - For app incidents: all users subscribed to the affected application.
   - For host incidents: all users subscribed to applications linked to the affected host (deduplicated by user).

3. **Preference Filtering**: Each subscriber's notification preferences are checked:
   - `notify_on_down`: Receive alerts when app goes DOWN / host goes OFFLINE
   - `notify_on_up`: Receive alerts when app recovers to UP / host returns ONLINE
   - `notify_on_degraded`: Receive alerts for DEGRADED state
   - `notify_on_slow`: Receive alerts for SLOW state

4. **Channel Dispatch**: For each matching subscriber, notifications are sent through all their enabled channels:
   - **Email**: HTML email via SMTP
   - **Telegram**: Message via Bot API
   - **Browser Push**: WebPush via VAPID

5. **Delivery Logging**: Every notification attempt is logged in `notification_log` with status (SENT/FAILED) and any error message.

## Channels

### Email
- Uses aiosmtplib for async SMTP delivery
- Sends both plain text and HTML versions
- Configure via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

### Telegram
- Uses Telegram Bot API via httpx
- Users provide their Chat ID (obtained by messaging the bot)
- Configure via `TELEGRAM_BOT_TOKEN`

### Browser Push
- Uses Web Push protocol with VAPID authentication
- Frontend registers service worker and sends subscription to backend
- Configure via `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`

## Anti-Spam Guarantees

1. Notifications only fire on state transitions, not on every check/heartbeat
2. The state machine requires consecutive failures/successes before transitions
3. Each notification is logged to prevent duplicate sends
4. Users control per-application notification preferences
5. Users can enable/disable individual channels
6. Host notifications are deduplicated by user across all linked applications
