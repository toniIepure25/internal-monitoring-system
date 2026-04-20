# Local testing guide

## Host monitoring without the macOS agent

The platform treats **heartbeats** as proof that a host is alive. You do **not** have to install the Python agent on a Mac if you only want to validate the product:

1. **Register a host** in the UI (Hosts → Register) or via `POST /api/hosts`. Save the returned `api_key`.
2. **Send the same HTTP request the agent would send**, from any machine that can reach your API (your laptop, a Linux box, CI, etc.):

```bash
curl -sS -X POST "http://localhost:8090/api/hosts/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-Host-API-Key: YOUR_HOST_API_KEY_HERE" \
  -d '{"hostname":"demo-host-1","os_version":"curl-test","uptime_seconds":12345,"ip_address":"127.0.0.1"}'
```

Repeat every ~30 seconds (or less than your host `heartbeat_timeout_seconds`) while testing. If you stop sending, after enough missed windows the scheduler will mark the host **OFFLINE** and open a **HOST** incident (if configured).

**Optional future enhancement:** a secondary check (e.g. ICMP ping or TCP connect to SSH) is *not* implemented as the primary signal; the design is heartbeat-first for accuracy on Macs behind NAT. Document any ping-based approach as **fallback only**.

---

## Prerequisites

- **PostgreSQL** and **Redis** running and reachable (Docker Compose for `postgres` + `redis`, or your own instances).
- **Python 3.11+** (3.10 often works) for backend and test-app.
- **Node.js** for the frontend.

---

## One-time setup

From the repository root:

```bash
cp .env.example .env
# Edit .env: set DATABASE_URL and REDIS_URL to your Postgres/Redis (see .env.example).
```

Create DB/user if needed, then migrations and seed:

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. python -m alembic upgrade head
PYTHONPATH=. python scripts/seed.py
```

**Seed logins** (from `backend/scripts/seed.py`):

| Email | Password | Role |
|-------|----------|------|
| `admin@company.internal` | `admin1234` | admin |
| `user@company.internal` | `user1234` | user |
| `ops@company.internal` | `ops12345` | user |

---

## Start services (typical local ports)

**Terminal 1 — demo test application (simulated app health)** on port **9000**:

```bash
cd test-app
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 9000
```

**Terminal 2 — backend** on port **8000** (loads `../.env` from `backend/`):

```bash
cd backend
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Ensure `MONITORING_ENABLED=true` in `.env` so health checks and host heartbeat jobs run.

**Terminal 3 — frontend** on port **3001** (see `frontend/package.json`):

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8090` in `frontend/.env.local` if the browser must call a different API host.

---

## Open the UI

1. Browser: **http://localhost:3040/login**
2. Sign in with e.g. `admin@company.internal` / `admin1234`
3. Explore **Dashboard**, **All Applications**, **Hosts**, **Incidents**, **Admin**

---

## Register the test app in the catalog

1. **All Applications** → **Add Application**
2. Base URL: `http://localhost:9000` (or `http://127.0.0.1:9000` depending on where the backend runs vs Docker network)
3. Complete discovery / set health URL to **`http://localhost:9000/health`** if needed
4. Optionally shorten **monitoring interval** in app settings for faster feedback during demos

---

## Validate monitoring + UI (start/stop test-app)

1. With **test-app running**, wait for checks (or your configured interval). Status should trend **UP** when `/health` returns healthy JSON.
2. **Stop** test-app (Ctrl+C in its terminal). After enough failed checks, status should go **DOWN** and an **incident** should appear.
3. **Start** test-app again. After recovery threshold, status should return **UP** and the incident should **resolve** in the UI timeline.

**Control without stopping the process:** while test-app is running, you can force behaviour:

```bash
curl -sS -X POST http://localhost:9000/control/down
curl -sS -X POST http://localhost:9000/control/up
curl -sS -X POST http://localhost:9000/control/reset
```

---

## Validate host path without macOS agent

1. **Hosts** → **Register** a host; copy **API key**
2. Run the `curl` heartbeat example above on a loop (e.g. `watch -n 25 'curl ...'`) or send manually a few times until status is **ONLINE**
3. Stop sending heartbeats; after timeout + miss threshold, host becomes **OFFLINE** in UI
4. Link the host to an application from host detail / API if you want to exercise **HOST_CAUSED** incidents when the app check fails while the host is offline

---

## API smoke check

```bash
curl -sS http://localhost:8090/docs
```

---

## Docker Compose alternative

`docker compose up --build` starts postgres, redis, backend, frontend, and **test-app** (port 9000). Use service hostnames inside the compose network (`http://test-app:9000`) when registering apps from the backend container.

### Why `localhost` / `127.0.0.1` is confusing

Health checks run **inside the backend process** (whatever machine or container runs `uvicorn`). A URL like `http://127.0.0.1:9000/health` means “port 9000 on **that same** host/container”, not “port 9000 on my laptop” unless the backend truly runs on the laptop with test-app on the same OS.

| Where backend runs | Use this base/health URL for test-app |
|--------------------|----------------------------------------|
| **Docker Compose** (`backend` service) | `http://test-app:9000` → health `http://test-app:9000/health` |
| **Same machine, no Docker** (uvicorn + test-app both on host) | `http://127.0.0.1:9000/health` is fine |
| **Backend in Docker, test-app only on host** | `http://host.docker.internal:9000` (Mac/Win Docker Desktop) or the host LAN IP — not `127.0.0.1` |

Your browser always uses **your** PC’s loopback; the monitor does **not** use the browser — it uses the backend’s network view.

---

## Troubleshooting migrations

If `alembic upgrade head` fails on a **fresh** database with duplicate enum errors from migration `001`, ensure migration `001` uses `create_type=False` + explicit `create` with `checkfirst=True` for enums (already fixed in this repo).

If your database had a **partial** migration `002` (e.g. `host_state` type exists but `hosts` table does not), run:

```sql
DROP TYPE IF EXISTS host_state CASCADE;
```

Then `PYTHONPATH=. alembic upgrade head` again. If core tables from `001` already exist but `alembic_version` is missing, use `alembic stamp 001` once, then `alembic upgrade head`.
