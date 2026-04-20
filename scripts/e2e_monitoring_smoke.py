#!/usr/bin/env python3
"""
End-to-end smoke test against a running API + test-app.

Requires:
  - Backend at API_BASE (default http://127.0.0.1:8000)
  - test-app at TEST_APP_URL (default http://127.0.0.1:9000) — same network view as backend
  - Seed user: admin@company.internal / admin1234

Usage:
  python3 scripts/e2e_monitoring_smoke.py
  API_BASE=http://127.0.0.1:8000 TEST_APP_URL=http://127.0.0.1:9000 python3 scripts/e2e_monitoring_smoke.py

Docker (backend sees test-app by service name):
  APP_MONITOR_URL=http://test-app:9000 TEST_APP_URL=http://127.0.0.1:9000 python3 scripts/e2e_monitoring_smoke.py

Exit code 0 on success, 1 on failure.
"""
from __future__ import annotations

import os
import sys
import time
import uuid

import httpx

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000").rstrip("/")
# Host-reachable test-app (control + preflight); often 127.0.0.1:9000 when ports are published.
TEST_APP = os.environ.get("TEST_APP_URL", "http://127.0.0.1:9000").rstrip("/")
# URL the backend worker uses to poll health (Docker: http://test-app:9000). Defaults to TEST_APP.
APP_MONITOR = os.environ.get("APP_MONITOR_URL", TEST_APP).rstrip("/")
EMAIL = os.environ.get("E2E_EMAIL", "admin@company.internal")
PASSWORD = os.environ.get("E2E_PASSWORD", "admin1234")
TIMEOUT = float(os.environ.get("E2E_TIMEOUT_SEC", "120"))
POLL = float(os.environ.get("E2E_POLL_SEC", "5"))


def main() -> int:
    client = httpx.Client(base_url=API_BASE, timeout=30.0)

    # 0) API up
    r = client.get("/docs")
    if r.status_code != 200:
        print("FAIL: API not reachable at", API_BASE, r.status_code)
        return 1

    # test-app up
    tr = httpx.get(f"{TEST_APP}/health", timeout=5.0)
    if tr.status_code != 200:
        print("FAIL: test-app not reachable at", TEST_APP, tr.status_code)
        return 1
    print("OK: API and test-app reachable")
    if APP_MONITOR != TEST_APP:
        print("    (backend will monitor", APP_MONITOR, "— host uses", TEST_APP, "for /control)")

    # 1) Login
    lr = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
    )
    if lr.status_code != 200:
        print("FAIL: login", lr.status_code, lr.text[:500])
        return 1
    token = lr.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    print("OK: logged in as", EMAIL)

    name = f"e2e-smoke-{uuid.uuid4().hex[:8]}"
    base = f"{APP_MONITOR}"

    # 2) Create application (triggers discovery in background)
    cr = client.post(
        "/api/applications",
        json={
            "display_name": name,
            "base_url": base,
            "environment": "e2e",
        },
    )
    if cr.status_code not in (200, 201):
        print("FAIL: create application", cr.status_code, cr.text[:800])
        return 1
    app = cr.json()
    app_id = app["id"]
    health_url = app.get("health_url") or f"{APP_MONITOR}/health"
    print("OK: created app", app_id, "health_url=", health_url)

    # Wait for background discovery (optional)
    for _ in range(24):
        if app.get("health_url"):
            break
        time.sleep(2.5)
        gr0 = client.get(f"/api/applications/{app_id}")
        if gr0.status_code == 200:
            app = gr0.json()
            health_url = app.get("health_url") or health_url

    if not app.get("health_url"):
        patch = client.patch(
            f"/api/applications/{app_id}/health-url",
            json={"health_url": f"{APP_MONITOR}/health"},
        )
        if patch.status_code != 200:
            print("FAIL: set health-url", patch.status_code, patch.text[:500])
            return 1
        health_url = patch.json().get("health_url", f"{APP_MONITOR}/health")
        print("OK: patched health_url to", health_url)

    pr = client.patch(
        f"/api/applications/{app_id}",
        json={
            "monitoring_interval_seconds": 15,
            "timeout_seconds": 5,
            "consecutive_failures_threshold": 2,
            "consecutive_recovery_threshold": 2,
            "slow_threshold_ms": 5000,
        },
    )
    if pr.status_code != 200:
        print("WARN: patch monitoring settings", pr.status_code, pr.text[:300])
    else:
        print("OK: monitoring interval set to 15s, failure threshold 2")

    def app_status() -> str | None:
        gr = client.get(f"/api/applications/{app_id}")
        if gr.status_code != 200:
            return None
        st = gr.json().get("status") or {}
        return (st.get("status") or "UNKNOWN").upper()

    # 3) Wait for UP
    deadline = time.monotonic() + TIMEOUT
    last = None
    while time.monotonic() < deadline:
        last = app_status()
        if last == "UP":
            break
        print("... status", last, "(waiting for UP)")
        time.sleep(POLL)
    if last != "UP":
        print("FAIL: expected UP, got", last, "after", TIMEOUT, "s")
        return 1
    print("OK: status UP")

    # 4) Flip test-app to down
    dr = httpx.post(f"{TEST_APP}/control/down", timeout=10.0)
    if dr.status_code != 200:
        print("FAIL: test-app control/down", dr.status_code)
        return 1

    deadline = time.monotonic() + TIMEOUT
    while time.monotonic() < deadline:
        last = app_status()
        if last == "DOWN":
            break
        print("... status", last, "(waiting for DOWN)")
        time.sleep(POLL)
    if last != "DOWN":
        print("FAIL: expected DOWN, got", last)
        return 1
    print("OK: status DOWN after /control/down")

    # 5) Recovery
    ur = httpx.post(f"{TEST_APP}/control/up", timeout=10.0)
    if ur.status_code != 200:
        print("FAIL: test-app control/up", ur.status_code)
        return 1

    deadline = time.monotonic() + TIMEOUT
    while time.monotonic() < deadline:
        last = app_status()
        if last == "UP":
            break
        print("... status", last, "(waiting for UP again)")
        time.sleep(POLL)
    if last != "UP":
        print("FAIL: expected UP after recovery, got", last)
        return 1
    print("OK: status UP after /control/up")

    # 6) Subscribe before another transition (so DOWN/UP incidents notify)
    sr = client.post(
        "/api/subscriptions",
        json={
            "application_id": app_id,
            "notify_on_down": True,
            "notify_on_up": True,
            "notify_on_degraded": False,
            "notify_on_slow": False,
        },
    )
    if sr.status_code not in (200, 201):
        print("FAIL: subscribe", sr.status_code, sr.text[:500])
        return 1
    print("OK: subscription created")

    # Optional: browser_push channel (needs real Web Push subscription from UI — usually fails without it)
    ch = client.post(
        "/api/notifications/channels",
        json={
            "channel_type": "browser_push",
            "config": {"subscription": {"endpoint": "https://example.invalid/push", "keys": {"p256dh": "x", "auth": "y"}}},
            "is_enabled": True,
        },
    )
    if ch.status_code in (200, 201):
        print("OK: placeholder browser_push channel created (push may log FAILED without VAPID/valid keys)")

    httpx.post(f"{TEST_APP}/control/down", timeout=10.0)
    deadline = time.monotonic() + TIMEOUT
    while time.monotonic() < deadline:
        if app_status() == "DOWN":
            break
        time.sleep(POLL)
    httpx.post(f"{TEST_APP}/control/up", timeout=10.0)
    deadline = time.monotonic() + TIMEOUT
    while time.monotonic() < deadline:
        if app_status() == "UP":
            break
        time.sleep(POLL)
    print("OK: post-subscription DOWN/UP cycle completed")

    # 7) Notification log (browser push requires VAPID + real subscription from UI)
    logr = client.get("/api/notifications/log?limit=20")
    if logr.status_code == 200:
        items = logr.json().get("items") or logr.json()
        if isinstance(items, list):
            print("OK: notification log entries:", len(items))
            for row in items[:5]:
                print("   ", row.get("channel_type"), row.get("status"), row.get("error_message", "")[:80])

    print()
    print("All automated checks passed.")
    print("Browser push: configure VAPID in backend .env, register push in UI (Settings),")
    print("then repeat DOWN/UP and check /api/notifications/log for browser_push SENT/FAILED.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
