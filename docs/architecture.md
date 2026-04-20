# Architecture

## System Overview

The Internal Monitoring System is a multi-component web platform for monitoring application health endpoints **and host/machine liveness**. It follows a clean layered architecture with clear separation of concerns.

The platform answers five key operational questions:
1. Is the application healthy?
2. Is the host machine online?
3. Is the app down because the host is down?
4. Who should be notified?
5. What is the current state across the fleet?

## Components

### Backend (FastAPI)
- **API Layer** (`app/api/`): Route handlers for all endpoints, organized by domain. Uses dependency injection for auth and DB sessions.
- **Services Layer** (`app/services/`): Business logic layer containing all domain operations. Services are stateless and operate on DB sessions passed by the API layer.
- **Models** (`app/models/`): SQLAlchemy 2.0 ORM models mapping directly to PostgreSQL tables.
- **Schemas** (`app/schemas/`): Pydantic models for request validation and response serialization.
- **Workers** (`app/workers/`): APScheduler-based monitoring worker that runs periodic health checks and host heartbeat monitoring.
- **Integrations** (`app/integrations/`): External service adapters for Telegram, SMTP, and WebPush.

### Host Agent (macOS)
- **Heartbeat Agent** (`host-agent/`): Lightweight Python daemon that runs on deployment Macs via launchd. Sends periodic heartbeats to the platform API.
- Authentication via per-host API keys (not user JWTs).
- Collects hostname, OS version, uptime, and IP address.
- Designed for zero-touch operation once installed.

### Demo/Test Backend
- **Test App** (`test-app/`): A controllable FastAPI service that simulates application health states. Used for end-to-end validation of monitoring, incident creation, and notification flows.

### Frontend (Next.js)
- **App Router** (`src/app/`): Pages organized by route using Next.js 14 App Router.
- **Components** (`src/components/`): Reusable UI components split by domain (layout, UI primitives, feature-specific).
- **Lib** (`src/lib/`): API client, auth context, and utility functions.
- **Types** (`src/types/`): Shared TypeScript interfaces mirroring backend DTOs.

### Infrastructure
- **PostgreSQL 16**: Primary data store with full schema migrations via Alembic.
- **Redis 7**: Status caching and notification queue.
- **Docker Compose**: Development orchestration for all services including test-app.

## Key Design Decisions

### APScheduler over Celery
The monitoring engine uses APScheduler (AsyncIOScheduler) because:
1. Monitoring is periodic scheduling, not task queuing
2. Runs in-process sharing FastAPI's async event loop
3. Simpler operational model (no separate broker process)
4. Notification dispatch uses async background tasks

### SQLAlchemy 2.0 Async
Chosen over SQLModel for:
1. Mature async support with asyncpg
2. Better handling of complex relationships
3. Full control over column types and constraints
4. Established migration tooling with Alembic

### JWT Authentication + Host API Keys
- User auth: Access tokens (30min) + refresh tokens (7d), bcrypt password hashing
- Host auth: Per-host API keys via `X-Host-API-Key` header for heartbeat ingestion
- Role stored in JWT claims for stateless authorization
- Structured to allow future SSO/OIDC integration

### Host Monitoring via Heartbeat (not ping)
- Heartbeat model is more reliable than ICMP ping for internal Macs
- Agents report rich metadata (OS version, uptime) not available via ping
- Works across network boundaries without requiring ICMP access
- Missed heartbeat detection runs server-side via scheduler
- Cloudflare Tunnel documented as optional for remote agents

## Data Flow

### Adding an Application
1. User submits base URL via frontend
2. API normalizes URL, checks for duplicates, creates application and initial status
3. Background task probes common health paths, scores candidates
4. Best candidate is auto-selected; user can override

### Health Monitoring
1. APScheduler triggers check_application() at configured intervals
2. HTTP GET to health URL with timeout
3. State machine evaluates response against thresholds
4. On state transition: create incident, check if linked host is offline for HOST_CAUSED classification
5. Dispatch notifications to subscribed users

### Host Monitoring
1. Host agent sends heartbeat POST every N seconds with API key auth
2. Backend records heartbeat, updates host_status, evaluates state transitions
3. Separate scheduler job checks for hosts that missed heartbeat_timeout_seconds
4. On ONLINE->OFFLINE transition: create HOST incident, notify subscribers
5. When app fails and linked host is OFFLINE: incident classified as HOST_CAUSED

### Failure Mode Classification
| Host Status | App Status | Incident Type |
|-------------|------------|---------------|
| ONLINE | DOWN | APPLICATION |
| OFFLINE | DOWN | HOST_CAUSED |
| OFFLINE | any | HOST |
| ONLINE | UP | (no incident) |

### Notifications
1. State transition triggers incident creation (app or host)
2. System queries all subscriptions for the affected application (or host-linked apps)
3. For each subscriber with matching preferences, dispatch to their enabled channels
4. Each delivery is logged in notification_log table

## Security Considerations
- All passwords hashed with bcrypt
- JWT tokens with expiration and type validation
- Host API keys are unique 64-char hex tokens, stored hashed or plain for internal use
- CORS restricted to configured origins
- Health probes use strict timeouts and no auth headers
- Admin endpoints require role-based authorization
- SQL injection prevented by ORM parameterized queries
