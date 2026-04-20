# Implementation Plan

## Phase 1: Bootstrap (Complete)
- Created monorepo structure with `backend/` and `frontend/` directories
- Set up Docker Compose with PostgreSQL 16, Redis 7, backend, and frontend services
- Created `.env.example` with all configuration options
- Set up Alembic with async migration support
- Created initial migration with all 11 tables and 7 enum types
- Configured structured logging with structlog

## Phase 2: Backend Core (Complete)
- Implemented JWT authentication (register, login, refresh, me)
- Built application CRUD with URL normalization and deduplication
- Implemented health endpoint discovery with scoring heuristics
- Built subscription management (create, list, update, delete)
- Built personal group management with application associations
- Implemented incident tracking with severity classification
- Created admin endpoints for system management
- Full Pydantic schema validation on all endpoints

## Phase 3: Monitoring Engine (Complete)
- Implemented APScheduler with AsyncIOScheduler for periodic checks
- Built health check executor with configurable timeout
- Implemented state machine with 5 states: UP, DOWN, DEGRADED, SLOW, UNKNOWN
- Consecutive failure/recovery thresholds prevent false positives
- Automatic incident creation on state transitions
- Dynamic job management (add/remove monitoring jobs)
- 17 unit tests covering all state transitions

## Phase 4: Notification System (Complete)
- Implemented notification dispatcher abstraction
- Built Telegram integration via Bot API
- Built email integration via aiosmtplib
- Built browser push integration via pywebpush/VAPID
- Per-user channel management with enable/disable
- Delivery logging for all notification attempts
- Test notification endpoint for verification
- Anti-spam: notifications only on state transitions

## Phase 5: Frontend (Complete)
- Built responsive Next.js 14 application with App Router
- Login/Register page with JWT token management
- Dashboard with status summary, personal groups, recent incidents
- Application catalog with search and status badges
- Application detail with health candidates, incidents, subscribe/rediscover actions
- Subscriptions, Groups, Incidents, Settings, and Admin pages
- Clean internal-tool aesthetic with Tailwind CSS

## Phase 6: Hardening (Complete)
- 39 unit tests (state machine, URL normalization, discovery scoring)
- Seed script for development data
- Complete documentation (architecture, API, notification flow)
- Docker Compose for one-command local setup
- Service worker for browser push notifications

---

## Phase 7: Host/Machine Monitoring (Complete)
- Added hosts as first-class monitored entities with ONLINE/OFFLINE/DEGRADED/UNKNOWN states
- Host domain model: hosts, host_status, host_heartbeats, application_hosts tables
- Heartbeat ingestion API with per-host API key authentication
- Host state machine with missed-heartbeat detection via scheduler
- Host incidents and notifications on ONLINE/OFFLINE transitions
- HOST_CAUSED incident classification when app fails due to offline host
- Host CRUD API with app-host binding management
- Alembic migration 002 for all new host tables

## Phase 8: macOS Host Agent (Complete)
- Lightweight Python heartbeat daemon at `host-agent/`
- Sends periodic heartbeats with hostname, OS version, uptime, IP
- launchd plist for automatic start on boot and restart on exit
- Install script and configuration via environment variables
- Documentation for macOS deployment

## Phase 9: Demo/Test Backend (Complete)
- Controllable FastAPI service at `test-app/` for E2E validation
- Endpoints: /health, /control/up, /control/down, /control/degraded, /control/slow, /control/reset
- Added to Docker Compose on port 9000
- Validates state transitions, incident creation, and notification flow

## Phase 10: UI/UX Upgrade (Complete)
- Dashboard overhaul with stat cards, host summary, improved groups and incidents
- New Hosts section: list, detail, and registration pages
- Better status badges, loading skeletons, empty states across all pages
- Improved tables, cards, and information hierarchy
- Application detail pages with host linkage visibility
- Incidents page with incident type classification (APP/HOST/HOST_CAUSED)
- Responsive, polished internal-tool aesthetic

## Phase 11: Final Hardening (Complete)
- Tests for host state machine and heartbeat logic
- Updated seed script with demo hosts
- Updated architecture, API, and notification flow documentation
- macOS agent installation documentation
- Demo scenario documentation

## Future Extensions
- SSO/OIDC authentication
- Slack/Teams notification channels
- Advanced escalation policies
- Per-team app ownership
- Uptime analytics and SLA reports
- WebSocket for real-time status updates
- Bulk operations in admin
- Host metrics collection (CPU, memory, disk)
- Cloudflare Tunnel integration for remote host agents
