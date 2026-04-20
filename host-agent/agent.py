#!/usr/bin/env python3
"""Lightweight host monitoring agent for macOS.

Sends periodic heartbeats to the Internal Monitoring System API.
Designed to run as a launchd agent on macOS deployment machines.

Configuration via environment variables or /etc/monitor-agent/config.env:
  MONITOR_SERVER_URL  - Base URL of the monitoring platform (required)
  MONITOR_API_KEY     - Host API key from the platform (required)
  MONITOR_INTERVAL    - Heartbeat interval in seconds (default: 30)
"""
import json
import os
import platform
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("monitor-agent")

CONFIG_FILE = "/etc/monitor-agent/config.env"


def load_config():
    if Path(CONFIG_FILE).exists():
        for line in Path(CONFIG_FILE).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

    server_url = os.environ.get("MONITOR_SERVER_URL", "").rstrip("/")
    api_key = os.environ.get("MONITOR_API_KEY", "")
    interval = int(os.environ.get("MONITOR_INTERVAL", "30"))

    if not server_url:
        log.error("MONITOR_SERVER_URL is required")
        sys.exit(1)
    if not api_key:
        log.error("MONITOR_API_KEY is required")
        sys.exit(1)

    return server_url, api_key, interval


def get_hostname():
    return socket.gethostname()


def get_os_version():
    try:
        result = subprocess.run(
            ["sw_vers", "-productVersion"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            return f"macOS {result.stdout.strip()}"
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return f"{platform.system()} {platform.release()}"


def get_uptime_seconds():
    try:
        result = subprocess.run(
            ["sysctl", "-n", "kern.boottime"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            # Format: { sec = 1713000000, usec = 0 } ...
            raw = result.stdout.strip()
            sec_part = raw.split("sec =")[1].split(",")[0].strip()
            boot_time = int(sec_part)
            return int(time.time()) - boot_time
    except Exception:
        pass
    # Fallback for Linux
    try:
        uptime_str = Path("/proc/uptime").read_text().split()[0]
        return int(float(uptime_str))
    except Exception:
        return None


def get_ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 53))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def send_heartbeat(server_url, api_key):
    url = f"{server_url}/api/hosts/heartbeat"
    payload = {
        "hostname": get_hostname(),
        "os_version": get_os_version(),
        "uptime_seconds": get_uptime_seconds(),
        "ip_address": get_ip_address(),
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-Host-API-Key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
            log.info("Heartbeat sent: %s (state: %s)", body.get("host_id", "?"), body.get("host_state", "?"))
            return True
    except urllib.error.HTTPError as e:
        log.warning("Heartbeat failed: HTTP %d - %s", e.code, e.read().decode()[:200])
        return False
    except Exception as e:
        log.warning("Heartbeat failed: %s", e)
        return False


def main():
    server_url, api_key, interval = load_config()
    log.info("Starting monitor agent: server=%s, interval=%ds, hostname=%s",
             server_url, interval, get_hostname())

    backoff = 1
    while True:
        success = send_heartbeat(server_url, api_key)
        if success:
            backoff = 1
            time.sleep(interval)
        else:
            time.sleep(min(backoff, 60))
            backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    main()
