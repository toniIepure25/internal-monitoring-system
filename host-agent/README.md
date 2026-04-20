# Host Monitor Agent

Lightweight heartbeat agent for macOS deployment machines. Sends periodic heartbeats to the Internal Monitoring System so the platform can track whether hosts are online/offline.

## Prerequisites

- macOS with Python 3 (ships with macOS)
- Network access to the monitoring server
- A host registered in the monitoring platform (to get the API key)

## Quick Setup

### 1. Register the host in the monitoring platform

Via the UI (Hosts > Register New Host) or API:

```bash
curl -X POST http://your-server:8000/api/hosts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hostname": "mac-deploy-01", "display_name": "Mac Deploy 01", "environment": "production"}'
```

Copy the `api_key` from the response.

### 2. Install the agent

```bash
cd host-agent/
MONITOR_SERVER_URL=http://your-server:8000 \
MONITOR_API_KEY=your-api-key-here \
bash install.sh
```

The install script will:
- Copy the agent to `/usr/local/bin/monitor-agent.py`
- Create config at `/etc/monitor-agent/config.env`
- Install a launchd plist to `~/Library/LaunchAgents/`
- Start the agent immediately

### 3. Verify

```bash
# Check if running
launchctl list | grep monitor-agent

# View logs
tail -f /tmp/monitor-agent.log
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MONITOR_SERVER_URL` | (required) | Base URL of the monitoring platform |
| `MONITOR_API_KEY` | (required) | Host API key from the platform |
| `MONITOR_INTERVAL` | `30` | Heartbeat interval in seconds |

Configuration is read from environment variables or `/etc/monitor-agent/config.env`.

## How It Works

1. Agent starts and reads configuration
2. Every N seconds, sends a POST to `/api/hosts/heartbeat` with:
   - Hostname
   - macOS version (via `sw_vers`)
   - Uptime (via `sysctl kern.boottime`)
   - IP address
3. Server updates host status and detects state transitions
4. If heartbeats stop arriving, server marks host as OFFLINE after timeout

## Management

```bash
# Stop agent
launchctl unload ~/Library/LaunchAgents/com.computacenter.monitor-agent.plist

# Start agent
launchctl load ~/Library/LaunchAgents/com.computacenter.monitor-agent.plist

# Uninstall completely
launchctl unload ~/Library/LaunchAgents/com.computacenter.monitor-agent.plist
rm ~/Library/LaunchAgents/com.computacenter.monitor-agent.plist
sudo rm /usr/local/bin/monitor-agent.py
sudo rm -rf /etc/monitor-agent
```

## Running Manually (for testing)

```bash
MONITOR_SERVER_URL=http://localhost:8000 \
MONITOR_API_KEY=your-key \
python3 agent.py
```

## Security

- The API key is stored in `/etc/monitor-agent/config.env` with mode 600
- Communication is over HTTP; use HTTPS in production or route through Cloudflare Tunnel
- The agent only sends outbound requests; no ports are opened on the host
