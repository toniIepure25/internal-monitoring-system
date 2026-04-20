"""Health endpoint discovery service.

Probes common health endpoint paths on a base URL, scores each candidate,
and selects the most likely health endpoint. This is best-effort -- users
can always override the selection manually.
"""
import asyncio
import json
import time
from datetime import datetime, timezone
from urllib.parse import urlparse, urlunparse
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.application import Application
from app.models.health_candidate import HealthCandidate
from app.utils.logging import get_logger

logger = get_logger(__name__)

CANDIDATE_PATHS = [
    "",
    "/health",
    "/healthz",
    "/health-check",
    "/healthcheck",
    "/status",
    "/statusz",
    "/api/health",
    "/actuator/health",
    "/actuator/info",
    "/live",
    "/livez",
    "/ready",
    "/readyz",
    "/ping",
    "/_health",
    "/api/v1/health",
    "/api/status",
    "/up",
]

HEALTH_KEYWORDS = {"status", "healthy", "ok", "up", "alive", "pass", "running"}
NEGATIVE_KEYWORDS = {"login", "signin", "sign-in", "password", "dashboard", "html"}
HEALTH_PATH_HINTS = ("health", "healthz", "status", "ready", "live", "ping", "up")


def _build_candidate_urls(base_url: str) -> list[str]:
    parsed = urlparse(base_url)
    root = parsed._replace(path="", params="", query="", fragment="")
    root_url = urlunparse(root).rstrip("/")
    base_path = parsed.path.rstrip("/")

    candidate_paths: list[str] = []
    if base_path:
        candidate_paths.append(base_path)
        for suffix in CANDIDATE_PATHS:
            if suffix:
                candidate_paths.append(f"{base_path}{suffix}")

    candidate_paths.extend(CANDIDATE_PATHS)

    deduped: list[str] = []
    seen: set[str] = set()
    for path in candidate_paths:
        normalized = path if path.startswith("/") or path == "" else f"/{path}"
        candidate = f"{root_url}{normalized}" if normalized else root_url
        if candidate not in seen:
            seen.add(candidate)
            deduped.append(candidate)
    return deduped


def _score_candidate(
    url: str,
    http_status: int | None,
    response_time_ms: int | None,
    content_type: str | None,
    body: str | None,
) -> tuple[float, bool, bool]:
    """Score a health endpoint candidate. Returns (score, is_json, has_health_indicators)."""
    score = 0.0
    is_json = False
    has_health_indicators = False

    if http_status is None:
        return 0.0, False, False

    path_lower = (urlparse(url).path or "/").lower()
    if any(hint in path_lower for hint in HEALTH_PATH_HINTS):
        score += 20
    if path_lower in ("/health", "/healthz", "/status", "/ready", "/live", "/ping", "/up"):
        score += 10
    if any(negative in path_lower for negative in NEGATIVE_KEYWORDS):
        score -= 25

    if http_status == 200:
        score += 30
    elif 200 < http_status < 300:
        score += 15
    elif http_status in (401, 403):
        score -= 15

    if content_type and "json" in content_type.lower():
        is_json = True
        score += 20
    elif content_type and "html" in content_type.lower():
        score -= 15

    if body:
        body_lower = body.lower()
        if any(kw in body_lower for kw in HEALTH_KEYWORDS):
            has_health_indicators = True
            score += 20
        if any(negative in body_lower for negative in NEGATIVE_KEYWORDS):
            score -= 20

        if is_json:
            try:
                data = json.loads(body)
                if isinstance(data, dict):
                    status_value = str(data.get("status", data.get("state", ""))).lower()
                    if status_value:
                        score += 20
                        has_health_indicators = True
                        if status_value in {"up", "ok", "healthy", "pass", "ready"}:
                            score += 10

                    for key in ("healthy", "ok", "alive", "ready"):
                        if data.get(key) is True:
                            score += 10
                            has_health_indicators = True

                    if isinstance(data.get("components"), dict):
                        score += 10
                        has_health_indicators = True
            except (json.JSONDecodeError, TypeError):
                pass

    if response_time_ms is not None and response_time_ms < 500:
        score += 10
    elif response_time_ms is not None and response_time_ms > 3000:
        score -= 10

    return max(0.0, min(score, 100.0)), is_json, has_health_indicators


async def _probe_candidate(
    client: httpx.AsyncClient, url: str
) -> dict:
    """Probe a single candidate URL."""
    start = time.monotonic()
    try:
        resp = await client.get(url, follow_redirects=True, timeout=settings.HEALTH_DISCOVERY_TIMEOUT_SECONDS)
        elapsed_ms = int((time.monotonic() - start) * 1000)
        body = resp.text[:2000]
        content_type = resp.headers.get("content-type", "")
        score, is_json, has_indicators = _score_candidate(
            url, resp.status_code, elapsed_ms, content_type, body
        )
        return {
            "url": url,
            "http_status": resp.status_code,
            "response_time_ms": elapsed_ms,
            "is_json": is_json,
            "has_health_indicators": has_indicators,
            "score": score,
            "probed_at": datetime.now(timezone.utc),
        }
    except Exception as e:
        logger.debug("probe_failed", url=url, error=str(e))
        return {
            "url": url,
            "http_status": None,
            "response_time_ms": None,
            "is_json": False,
            "has_health_indicators": False,
            "score": 0.0,
            "probed_at": datetime.now(timezone.utc),
        }


async def discover_health_endpoints(
    db: AsyncSession, application_id: UUID, base_url: str
) -> list[HealthCandidate]:
    """Probe candidate health endpoints and store results."""
    candidate_urls = _build_candidate_urls(base_url.rstrip("/"))

    async with httpx.AsyncClient(
        verify=False,
        headers={"User-Agent": "InternalMonitor/1.0 HealthCheck"},
    ) as client:
        tasks = [_probe_candidate(client, url) for url in candidate_urls]
        results = await asyncio.gather(*tasks)

    # Clear old candidates
    old = await db.execute(
        select(HealthCandidate).where(HealthCandidate.application_id == application_id)
    )
    for c in old.scalars().all():
        await db.delete(c)
    await db.flush()

    candidates = []
    for r in results:
        candidate = HealthCandidate(application_id=application_id, **r)
        db.add(candidate)
        candidates.append(candidate)

    await db.flush()

    # Select best candidate
    scored = sorted(candidates, key=lambda c: c.score, reverse=True)
    if scored and scored[0].score > 0:
        best = scored[0]
        best.is_selected = True

        app_result = await db.execute(
            select(Application).where(Application.id == application_id)
        )
        app = app_result.scalar_one_or_none()
        if app:
            app.health_url = best.url

        await db.flush()
        logger.info(
            "discovery_complete",
            app_id=str(application_id),
            best_url=best.url,
            best_score=best.score,
            total_candidates=len(candidates),
        )

    return candidates
