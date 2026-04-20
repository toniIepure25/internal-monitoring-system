# Internal Monitoring System

A full-stack platform for tracking the health of internal services, deployment hosts, and subscription-based alerts from a single operational workspace.

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
- Dark/light theme with premium animated network background
- Global command palette (Cmd+K), toast notifications, sortable/paginated tables

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | FastAPI, SQLAlchemy Async, Alembic, APScheduler, Pydantic |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS 3.4, Framer Motion |
| Database | PostgreSQL (asyncpg) |
| Cache | Redis |
| Notifications | Web Push (VAPID), SMTP, Telegram Bot API |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- **Or** for local development:
  - Node.js >= 18
  - Python >= 3.11
  - PostgreSQL 15+
  - Redis

### One-command deploy (recommended)

```bash
sh deploy.sh
```

This script handles everything automatically:

- Checks that Git, Docker, and Docker Compose are installed and running
- Pulls the latest code from the current branch
- Creates `.env` from `.env.example` if it doesn't exist
- Generates a random `SECRET_KEY` if one hasn't been set
- Detects already-running containers and rebuilds them
- Builds all Docker images in parallel
- Starts the full stack (Postgres, Redis, backend, frontend, test app)
- Waits for health checks to pass on each service
- Prints a status summary with URLs

Other commands:

```bash
sh deploy.sh --status   # Show container status
sh deploy.sh --logs     # Tail live logs from all services
sh deploy.sh --down     # Stop and remove all containers
sh deploy.sh            # Redeploy / pull latest and rebuild
```

### Start with Docker (manual)

```bash
cp .env.example .env
docker compose up -d --build
```

### Start locally (without Docker)

#### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Set up the database and start the server:

```bash
cp ../.env.example ../.env       # edit DATABASE_URL, REDIS_URL for local values
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. uvicorn app.main:app --reload --port 8090
```

#### Frontend

```bash
cd frontend
cp .env.example .env.local       # edit if backend is not on localhost:8090
npm install
npm run dev
```

The frontend runs on `http://localhost:3040` by default.

### Access

| Service | Local | Cloudflare |
|---------|-------|------------|
| Frontend | `http://localhost:3040` | `https://monitoring-system.ccrolabs.com` |
| Backend API | `http://localhost:8090` | `https://monitoring-system-api.ccrolabs.com` |
| API docs (Swagger) | `http://localhost:8090/docs` | |

Demo login: `admin@company.internal` / `admin1234`

## Frontend Dependencies

These are installed automatically with `npm install`:

| Package | Purpose |
|---------|---------|
| `next` | React framework (App Router) |
| `react`, `react-dom` | UI library |
| `framer-motion` | Page transitions, staggered reveals, hover interactions |
| `@heroicons/react` | Icon set (outline style) |
| `tailwindcss`, `@tailwindcss/forms` | Utility-first CSS, form reset |
| `clsx`, `tailwind-merge` | Class name utilities |
| `date-fns` | Date formatting |

## Backend Dependencies

Installed via `pip install -r requirements.txt`:

| Package | Purpose |
|---------|---------|
| `fastapi`, `uvicorn` | Web framework and ASGI server |
| `sqlalchemy[asyncio]`, `asyncpg` | Async ORM and PostgreSQL driver |
| `alembic` | Database migrations |
| `apscheduler` | Background monitoring scheduler |
| `pydantic`, `pydantic-settings` | Validation and configuration |
| `python-jose`, `passlib`, `bcrypt` | JWT auth and password hashing |
| `httpx` | Async HTTP client for health checks |
| `redis[hiredis]` | Cache and scheduler backend |
| `pywebpush`, `py-vapid` | Browser push notifications |
| `aiosmtplib`, `email-validator` | Email notifications |
| `structlog` | Structured logging |
| `pytest`, `pytest-asyncio` | Testing |

## Product Areas

### Applications

Applications are added by URL. The platform can:

- Discover likely health endpoints automatically
- Run an immediate initial check after registration
- Continue checks at the configured interval
- Classify application state as `UP`, `DOWN`, `DEGRADED`, `SLOW`, or `UNKNOWN`

### Hosts

Hosts are monitored through heartbeats. This allows the system to distinguish:

- Application failures
- Host failures
- Host-caused application outages

### Notifications

Notifications are only sent on meaningful state transitions, not every check.

Supported channels: Browser push, Email, Telegram.

The UI includes per-application subscription management and full notification delivery history with filtering.

### Dashboard

Overview page showing application metrics, host status, active incidents, and subscription count with animated stat counters and staggered section reveals.

## UI Features

- **Design system**: Semantic HSL color tokens for dark and light themes, consistent typography and spacing
- **Animations**: Framer Motion page transitions, staggered section entrances, hover interactions, animated number counters
- **Network background**: Canvas-based animated node graph with connecting lines, theme-aware colors
- **Command palette**: `Cmd+K` / `Ctrl+K` global search with keyboard navigation
- **Toast notifications**: Context-based success/error/info toasts replacing all browser alerts
- **Confirm dialogs**: Promise-based confirmation modals for destructive actions
- **Pagination**: Client-side pagination (20 items/page) on all data tables
- **Sortable columns**: Click-to-sort on all table headers
- **Theme toggle**: Dark/light mode switch with localStorage persistence

## Configuration

Copy `.env.example` to `.env` and adjust values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SECRET_KEY` | JWT signing secret |
| `MONITORING_ENABLED` | Enable/disable background health checks |
| `NEXT_PUBLIC_API_URL` | Backend URL for the frontend |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` | Browser push keys |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key for the frontend |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | Email channel |
| `TELEGRAM_BOT_TOKEN` | Telegram channel |

## Local Demo Workflow

The repository includes a demo service on port `9000` for testing monitoring behavior.

1. Log in to the frontend
2. Add an application that points to the demo app
3. Subscribe to that application
4. Enable browser push in Settings
5. Force the demo service down / back up:

```bash
curl -X POST http://localhost:9000/control/down
curl -X POST http://localhost:9000/control/up
```

## Monitoring Behavior

Each application stores a health URL, timeout, polling interval, slow-response threshold, and consecutive failure/recovery thresholds. The scheduler loads active applications at startup and keeps polling jobs in sync with application settings.

## Discovery Engine

The discovery service probes root-level and nested path candidates, scoring likely operational endpoints higher than generic pages. It favors paths like `/health`, `/ready`, `/live`, and `/status`, penalizes login pages and HTML dashboards, and rewards JSON payloads with health indicators. Users can override the selected health URL from the application detail page.

## Validation

```bash
# Backend tests (Docker)
docker exec internal-monitoring-system-backend-1 pytest -q

# Frontend build check
cd frontend && npm run build
```

## Repository Structure

```text
backend/      FastAPI application, workers, services, models, tests
frontend/     Next.js application and UI components
docs/         Architecture and functional notes
host-agent/   Host heartbeat agent assets
test-app/     Demo application used for local monitoring tests
deploy.sh     One-command deploy script (Docker)
```

## Documentation

- [Architecture](docs/architecture.md)
- [API Overview](docs/api-overview.md)
- [Notification Flow](docs/notification-flow.md)
- [Local Testing Guide](docs/local-testing-guide.md)
- [Implementation Plan](docs/implementation-plan.md)
