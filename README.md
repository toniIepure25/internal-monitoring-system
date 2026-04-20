# Internal Monitoring System

Internal Monitoring System is a full-stack platform for tracking the health of internal services, deployment hosts, and subscription-based alerts from a single operational workspace.

It combines smart health endpoint discovery, continuous polling, incident tracking, host heartbeat monitoring, and multi-channel notifications in a product designed for internal operations teams.

## Highlights

- Shared application catalog with per-user subscriptions
- Smart health discovery with path heuristics, body analysis, and manual override
- Immediate first health check on application registration
- Continuous monitoring with configurable polling intervals
- Host heartbeat monitoring and host-caused outage classification
- Incident history and notification delivery history
- Browser push, email, and Telegram notification channels
- Personal grouping and per-application alert preferences

## Tech Stack

- Backend: FastAPI, SQLAlchemy Async, Alembic, APScheduler
- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- Database: PostgreSQL
- Cache / scheduling support: Redis
- Notifications: Web Push (VAPID), SMTP, Telegram Bot API

## Product Areas

### Applications

Applications are added by URL. The platform can:

- discover likely health endpoints automatically
- run an immediate initial check after registration
- continue checks at the configured interval
- classify application state as `UP`, `DOWN`, `DEGRADED`, `SLOW`, or `UNKNOWN`

### Hosts

Hosts are monitored through heartbeats. This allows the system to distinguish:

- application failures
- host failures
- host-caused application outages

### Notifications

Notifications are only sent on meaningful state transitions, not every check.

Supported channels:

- Browser push
- Email
- Telegram

The UI includes:

- `My Subscriptions` for alert preferences
- `My Notifications` for notification delivery history

## Quick Start

### Prerequisites

- Docker
- Docker Compose

### Start The Stack

```bash
cp .env.example .env
docker compose up -d --build
```

### Access

- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

Demo login:

- `admin@company.internal` / `admin1234`

## Local Demo Workflow

The repository includes a demo service on port `9000` so you can test monitoring behavior quickly.

### Example flow

1. Log in to the frontend
2. Add an application that points to the demo app
3. Subscribe to that application
4. Enable browser push in `Settings`
5. Force the demo service down

Bring the demo service down:

```bash
curl -X POST http://localhost:9000/control/down
```

Bring it back up:

```bash
curl -X POST http://localhost:9000/control/up
```

## Configuration

Important environment values:

- `DATABASE_URL`
- `REDIS_URL`
- `MONITORING_ENABLED`
- `NEXT_PUBLIC_API_URL`
- `VAPID_PRIVATE_KEY`
- `VAPID_PUBLIC_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Copy `.env.example` and adjust values for your environment.

## Monitoring Behavior

Each application stores:

- health URL
- timeout
- polling interval
- slow-response threshold
- consecutive failure threshold
- consecutive recovery threshold

The scheduler:

- loads active applications at startup
- keeps polling jobs in sync with application settings
- runs host heartbeat checks in parallel

## Discovery Engine

The discovery service is designed to be practical in real internal environments.

It now:

- probes both root-level and nested path candidates
- scores likely operational endpoints higher than generic pages
- favors health-like paths such as `/health`, `/ready`, `/live`, and `/status`
- penalizes login pages and HTML dashboard responses
- rewards JSON payloads with operational health indicators
- detects structured status signals such as `status`, `state`, `healthy`, `ready`, and component maps

Users can still override the selected health URL manually from the application detail page.

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Validation

Backend tests:

```bash
docker exec internal-monitoring-system-backend-1 pytest -q
```

## Repository Structure

```text
backend/      FastAPI application, workers, services, models, tests
frontend/     Next.js application and UI
docs/         Architecture and functional notes
host-agent/   Host heartbeat agent assets
test-app/     Demo application used for local monitoring tests
```

## Documentation

- [Architecture](docs/architecture.md)
- [API Overview](docs/api-overview.md)
- [Notification Flow](docs/notification-flow.md)
- [Local Testing Guide](docs/local-testing-guide.md)
- [Implementation Plan](docs/implementation-plan.md)

## Status

This repository is structured for active product development and local operational validation. It includes seed users, a demo application, and a monitoring flow that can be exercised end to end on a local machine.
