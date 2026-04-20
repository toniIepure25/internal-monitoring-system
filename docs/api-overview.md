# API Overview

Base URL: `http://localhost:8090`

Interactive docs: `http://localhost:8090/docs`

All endpoints except `/api/auth/register`, `/api/auth/login`, and `/api/hosts/heartbeat` require a Bearer token in the Authorization header.

The heartbeat endpoint uses `X-Host-API-Key` header authentication.

## Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create new user account |
| POST | `/api/auth/login` | Authenticate and get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user profile |

## Applications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/applications` | Add new application (triggers discovery) |
| GET | `/api/applications` | List all applications with status |
| GET | `/api/applications/{id}` | Application detail with candidates |
| PATCH | `/api/applications/{id}` | Update application settings |
| PATCH | `/api/applications/{id}/health-url` | Manual health URL override |
| POST | `/api/applications/{id}/rediscover` | Re-run health discovery |

## Hosts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/hosts` | Register a new host (generates API key) |
| GET | `/api/hosts` | List all hosts with status |
| GET | `/api/hosts/{id}` | Host detail with apps, recent heartbeats |
| PATCH | `/api/hosts/{id}` | Update host settings |
| POST | `/api/hosts/{id}/regenerate-key` | Generate new API key |
| POST | `/api/hosts/{id}/applications` | Link an application to host |
| DELETE | `/api/hosts/{id}/applications/{app_id}` | Unlink application from host |
| POST | `/api/hosts/heartbeat` | Heartbeat ingestion (API key auth) |

## Subscriptions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/subscriptions` | Subscribe to an application |
| GET | `/api/subscriptions` | List my subscriptions |
| PATCH | `/api/subscriptions/{id}` | Update notification preferences |
| DELETE | `/api/subscriptions/{id}` | Unsubscribe |

## Personal Groups

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/groups` | Create group |
| GET | `/api/groups` | List my groups with apps |
| PATCH | `/api/groups/{id}` | Update group |
| DELETE | `/api/groups/{id}` | Delete group |
| POST | `/api/groups/{id}/applications` | Add app to group |
| DELETE | `/api/groups/{id}/applications/{app_id}` | Remove app from group |

## Incidents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/incidents` | List incidents (filterable by type) |
| GET | `/api/incidents/{id}` | Incident detail |

## Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/channels` | List my channels |
| POST | `/api/notifications/channels` | Add notification channel |
| PATCH | `/api/notifications/channels/{id}` | Update channel |
| POST | `/api/notifications/test` | Send test notification |
| GET | `/api/notifications/log` | Delivery history |

## Admin (requires admin role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/applications` | All apps with admin controls |
| PATCH | `/api/admin/applications/{id}` | Toggle active/maintenance |
| GET | `/api/admin/users` | User management |
| GET | `/api/admin/system` | System health metrics (includes host stats) |

## Common Query Parameters

- `offset` (int): Pagination offset (default: 0)
- `limit` (int): Items per page (default: 50, max: 200)
- `search` (string): Text search on name/URL
- `application_id` (UUID): Filter by application
- `host_id` (UUID): Filter by host
- `status` (string): Filter by status
- `incident_type` (string): Filter incidents by type (APPLICATION, HOST, HOST_CAUSED)
