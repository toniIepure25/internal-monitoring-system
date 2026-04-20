"""Controllable test application for E2E monitoring validation.

Simulates a deployable application with a health endpoint whose state
can be changed via control endpoints. Used to validate that the monitoring
platform correctly detects state transitions, creates incidents, and
dispatches notifications.
"""
import asyncio
import time

from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="Test Application", description="Controllable health endpoint for monitoring validation")

state = {
    "mode": "up",
    "slow_delay_seconds": 5.0,
}


@app.get("/health")
async def health():
    mode = state["mode"]

    if mode == "up":
        return JSONResponse({"status": "healthy", "mode": "up"}, status_code=200)

    elif mode == "down":
        return JSONResponse({"status": "unhealthy", "mode": "down", "error": "simulated failure"}, status_code=500)

    elif mode == "degraded":
        return JSONResponse({"status": "degraded", "mode": "degraded", "warning": "partial functionality"}, status_code=200)

    elif mode == "slow":
        await asyncio.sleep(state["slow_delay_seconds"])
        return JSONResponse({"status": "healthy", "mode": "slow", "delayed_seconds": state["slow_delay_seconds"]}, status_code=200)

    return JSONResponse({"status": "unknown", "mode": mode}, status_code=200)


@app.post("/control/up")
async def set_up():
    state["mode"] = "up"
    return {"status": "ok", "mode": "up", "message": "App is now healthy"}


@app.post("/control/down")
async def set_down():
    state["mode"] = "down"
    return {"status": "ok", "mode": "down", "message": "App is now unhealthy (500)"}


@app.post("/control/degraded")
async def set_degraded():
    state["mode"] = "degraded"
    return {"status": "ok", "mode": "degraded", "message": "App is now degraded"}


@app.post("/control/slow")
async def set_slow(delay_seconds: float = 5.0):
    state["mode"] = "slow"
    state["slow_delay_seconds"] = delay_seconds
    return {"status": "ok", "mode": "slow", "delay_seconds": delay_seconds, "message": f"App will respond after {delay_seconds}s delay"}


@app.post("/control/reset")
async def reset():
    state["mode"] = "up"
    state["slow_delay_seconds"] = 5.0
    return {"status": "ok", "mode": "up", "message": "Reset to healthy defaults"}


@app.get("/control/status")
async def control_status():
    return {"current_mode": state["mode"], "slow_delay_seconds": state["slow_delay_seconds"]}


@app.get("/")
async def root():
    return {
        "service": "test-app",
        "description": "Controllable test application for monitoring validation",
        "endpoints": {
            "GET /health": "Health endpoint (state depends on current mode)",
            "POST /control/up": "Set mode to healthy",
            "POST /control/down": "Set mode to unhealthy (500)",
            "POST /control/degraded": "Set mode to degraded",
            "POST /control/slow": "Set mode to slow response",
            "POST /control/reset": "Reset to healthy defaults",
            "GET /control/status": "Current simulated state",
        },
    }
