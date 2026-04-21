"""Health endpoint discovery service.

Instead of only guessing from a static list, the discovery service actively
searches for health endpoints by:

1. Crawling the root page HTML for links
2. Fetching OpenAPI / Swagger specs to extract all API routes
3. Parsing robots.txt for paths
4. Reading response headers for framework hints (Next.js, FastAPI, Spring, etc.)
5. Probing framework-specific paths based on what it detects
6. Falling back to the standard candidate list for anything not found above

This is best-effort -- users can always override the selection manually.
"""
import asyncio
import json
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlparse, urlunparse, urljoin
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.application import Application
from app.models.health_candidate import HealthCandidate
from app.utils.logging import get_logger

logger = get_logger(__name__)

# ── Static fallback paths (used alongside discovered ones) ────────────────────
FALLBACK_PATHS = [
    "/health", "/healthz", "/health-check", "/healthcheck",
    "/status", "/api/health", "/api/healthz", "/api/status",
    "/api/v1/health", "/api/v1/status",
    "/actuator/health", "/actuator/info",
    "/live", "/livez", "/ready", "/readyz",
    "/ping", "/_health", "/up", "/__health",
    "/heartbeat", "/hc", "/api/ping",
    "",
]

# Paths to check for API specs and metadata
SPEC_PATHS = [
    "/openapi.json", "/swagger.json", "/swagger/v1/swagger.json",
    "/api-docs", "/docs", "/_catalog",
]

# Framework-specific path sets (added when framework is detected)
FRAMEWORK_PATHS: dict[str, list[str]] = {
    "nextjs": ["/api/health", "/api/status", "/api/ping"],
    "fastapi": ["/health", "/docs", "/openapi.json", "/api/health"],
    "spring": ["/actuator/health", "/actuator/info", "/actuator/metrics", "/actuator/env"],
    "express": ["/health", "/healthz", "/api/health", "/status"],
    "django": ["/health/", "/ht/", "/api/health/", "/status/"],
    "rails": ["/up", "/health", "/rails/health"],
    "flask": ["/health", "/healthz", "/api/health"],
    "dotnet": ["/health", "/healthz", "/_health", "/api/health"],
}

HEALTH_KEYWORDS = {"status", "healthy", "ok", "up", "alive", "pass", "running", "ready", "live"}
NEGATIVE_KEYWORDS = {"login", "signin", "sign-in", "password", "dashboard", "<!doctype", "<html"}

TIER1_PATHS = frozenset(("/health", "/healthz", "/api/health", "/actuator/health"))
TIER2_PATHS = frozenset(("/status", "/health-check", "/healthcheck", "/api/v1/health", "/api/healthz"))
TIER3_PATHS = frozenset(("/live", "/livez", "/ready", "/readyz", "/ping", "/up", "/_health", "/__health"))


# ── HTML link extractor ───────────────────────────────────────────────────────

class _LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        if tag in ("a", "link"):
            for name, val in attrs:
                if name == "href" and val:
                    self.links.append(val)


def _extract_links_from_html(html: str, base_url: str) -> set[str]:
    """Pull all href links from HTML and resolve them to absolute URLs."""
    parser = _LinkExtractor()
    try:
        parser.feed(html)
    except Exception:
        return set()

    paths: set[str] = set()
    for link in parser.links:
        if link.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        resolved = urljoin(base_url + "/", link)
        parsed = urlparse(resolved)
        base_parsed = urlparse(base_url)
        if parsed.netloc == base_parsed.netloc:
            path = parsed.path.rstrip("/") or "/"
            paths.add(path)
    return paths


# ── OpenAPI spec parser ───────────────────────────────────────────────────────

def _extract_paths_from_openapi(spec: dict) -> set[str]:
    """Extract endpoint paths from an OpenAPI/Swagger spec."""
    paths: set[str] = set()
    base = ""

    if "basePath" in spec:
        base = spec["basePath"].rstrip("/")

    if isinstance(spec.get("servers"), list):
        for server in spec["servers"]:
            url = server.get("url", "")
            p = urlparse(url).path.rstrip("/")
            if p:
                base = p
                break

    for path in spec.get("paths", {}):
        full = f"{base}{path}" if base else path
        paths.add(full)

    return paths


# ── robots.txt parser ─────────────────────────────────────────────────────────

def _extract_paths_from_robots(text: str) -> set[str]:
    """Pull paths from robots.txt Disallow/Allow/Sitemap directives."""
    paths: set[str] = set()
    for line in text.splitlines():
        line = line.strip()
        for directive in ("Disallow:", "Allow:", "Sitemap:"):
            if line.startswith(directive):
                val = line[len(directive):].strip()
                if val and not val.startswith("http"):
                    path = val.split("*")[0].split("?")[0].rstrip("/")
                    if path and len(path) < 200:
                        paths.add(path)
    return paths


# ── Framework detection ───────────────────────────────────────────────────────

def _detect_frameworks(headers: dict[str, str], body: str) -> set[str]:
    """Detect likely frameworks from response headers and body."""
    detected: set[str] = set()
    all_headers = " ".join(f"{k}: {v}" for k, v in headers.items()).lower()
    body_lower = body[:5000].lower() if body else ""

    if "x-powered-by" in all_headers:
        powered = headers.get("x-powered-by", "").lower()
        if "next" in powered:
            detected.add("nextjs")
        if "express" in powered:
            detected.add("express")

    if "server" in headers:
        server = headers["server"].lower()
        if "uvicorn" in server or "starlette" in server:
            detected.add("fastapi")
        if "gunicorn" in server:
            detected.add("flask")
        if "nginx" in server or "apache" in server:
            pass  # too generic

    if "__next" in body_lower or "/_next/" in body_lower:
        detected.add("nextjs")
    if "swagger" in body_lower or "openapi" in body_lower:
        detected.add("fastapi")
    if "csrfmiddlewaretoken" in body_lower or "django" in body_lower:
        detected.add("django")
    if "spring" in all_headers or "x-application-context" in all_headers:
        detected.add("spring")
    if "x-aspnet" in all_headers or "asp.net" in all_headers:
        detected.add("dotnet")
    if "x-request-id" in all_headers and "x-runtime" in all_headers:
        detected.add("rails")

    return detected


# ── URL builder (now with discovery) ──────────────────────────────────────────

async def _discover_paths(client: httpx.AsyncClient, base_url: str) -> set[str]:
    """Actively search for paths by crawling the app."""
    root_url = base_url.rstrip("/")
    discovered: set[str] = set()
    detected_frameworks: set[str] = set()

    async def _safe_get(url: str, **kwargs) -> httpx.Response | None:
        try:
            return await client.get(url, follow_redirects=True, timeout=8, **kwargs)
        except Exception:
            return None

    # 1. Fetch root page -- extract links + detect framework
    root_resp = await _safe_get(root_url)
    if root_resp and root_resp.status_code < 400:
        ct = root_resp.headers.get("content-type", "")
        body = root_resp.text[:10000]

        detected_frameworks = _detect_frameworks(dict(root_resp.headers), body)

        if "html" in ct.lower():
            html_links = _extract_links_from_html(body, root_url)
            for path in html_links:
                if any(hint in path.lower() for hint in (
                    "health", "status", "api", "ping", "live", "ready",
                    "heartbeat", "version", "info", "metrics",
                )):
                    discovered.add(path)

    # 2. Fetch OpenAPI / Swagger specs
    for spec_path in SPEC_PATHS:
        resp = await _safe_get(f"{root_url}{spec_path}")
        if resp and resp.status_code == 200:
            ct = resp.headers.get("content-type", "")
            if "json" in ct.lower():
                try:
                    spec = resp.json()
                    api_paths = _extract_paths_from_openapi(spec)
                    for p in api_paths:
                        if any(hint in p.lower() for hint in (
                            "health", "status", "ping", "live", "ready",
                            "heartbeat", "version", "info",
                        )):
                            discovered.add(p)
                    logger.info("openapi_spec_found", url=f"{root_url}{spec_path}", paths_found=len(api_paths))
                except Exception:
                    pass

    # 3. Parse robots.txt
    robots_resp = await _safe_get(f"{root_url}/robots.txt")
    if robots_resp and robots_resp.status_code == 200:
        ct = robots_resp.headers.get("content-type", "")
        if "text" in ct.lower():
            robot_paths = _extract_paths_from_robots(robots_resp.text)
            for p in robot_paths:
                if any(hint in p.lower() for hint in ("api", "health", "status")):
                    discovered.add(p)

    # 4. Add framework-specific paths
    for fw in detected_frameworks:
        for p in FRAMEWORK_PATHS.get(fw, []):
            discovered.add(p)

    if detected_frameworks:
        logger.info("frameworks_detected", frameworks=list(detected_frameworks))

    return discovered


def _build_candidate_urls(base_url: str, extra_paths: set[str] | None = None) -> list[str]:
    parsed = urlparse(base_url)
    root = parsed._replace(path="", params="", query="", fragment="")
    root_url = urlunparse(root).rstrip("/")
    base_path = parsed.path.rstrip("/")

    all_paths: list[str] = []

    # Discovered paths go first (higher priority)
    if extra_paths:
        all_paths.extend(sorted(extra_paths))

    # Then base_path variants
    if base_path:
        all_paths.append(base_path)
        for suffix in FALLBACK_PATHS:
            if suffix:
                all_paths.append(f"{base_path}{suffix}")

    # Then static fallbacks
    all_paths.extend(FALLBACK_PATHS)

    deduped: list[str] = []
    seen: set[str] = set()
    for path in all_paths:
        normalized = path if path.startswith("/") or path == "" else f"/{path}"
        candidate = f"{root_url}{normalized}" if normalized else root_url
        if candidate not in seen:
            seen.add(candidate)
            deduped.append(candidate)
    return deduped


# ── Scoring (unchanged) ──────────────────────────────────────────────────────

def _score_candidate(
    url: str,
    http_status: int | None,
    response_time_ms: int | None,
    content_type: str | None,
    body: str | None,
    is_frontend_url: bool = False,
) -> tuple[float, bool, bool]:
    """Score a health endpoint candidate. Returns (score, is_json, has_health_indicators).

    When ``is_frontend_url`` is True the candidate is the app's root page.
    Instead of applying the normal HTML/body penalties we give it a fixed
    "frontend alive" score -- if the page loads, the app is up.
    """
    score = 0.0
    is_json = False
    has_health_indicators = False

    if http_status is None:
        return 0.0, False, False

    if http_status >= 400:
        return 0.0, False, False

    path_lower = (urlparse(url).path or "/").lower()

    # ── Frontend alive check (special case) ───────────────────────────
    # The root page is HTML, so the normal scoring would penalise it into
    # oblivion.  But if it returns 200, the app is reachable and we should
    # keep it as a viable fallback.  We give it a flat score of 18 -- high
    # enough to be selected when no real health endpoint exists, low enough
    # to lose to any proper /health JSON endpoint.
    if is_frontend_url and path_lower in ("", "/"):
        if http_status == 200:
            frontend_score = 18.0
            if response_time_ms is not None and response_time_ms < 500:
                frontend_score += 2.0
            return frontend_score, False, False
        return 0.0, False, False

    if http_status == 200:
        score += 15
    elif 200 < http_status < 300:
        score += 5

    is_html = False
    if content_type:
        ct = content_type.lower()
        if "json" in ct:
            is_json = True
            score += 10
        elif "html" in ct:
            is_html = True
            score -= 20
        elif "text/plain" in ct:
            score += 2

    if path_lower in TIER1_PATHS:
        score += 25
    elif path_lower in TIER2_PATHS:
        score += 18
    elif path_lower in TIER3_PATHS:
        score += 12
    elif path_lower in ("", "/"):
        score -= 10

    if any(neg in path_lower for neg in ("login", "signin", "password", "dashboard", "admin")):
        score -= 30

    if body:
        body_lower = body.lower()

        if any(neg in body_lower for neg in NEGATIVE_KEYWORDS):
            score -= 15

        if is_json:
            try:
                data = json.loads(body)
                if isinstance(data, dict):
                    status_val = str(
                        data.get("status", data.get("state", data.get("health", "")))
                    ).lower()

                    if status_val in ("up", "ok", "healthy", "pass", "ready", "running"):
                        score += 30
                        has_health_indicators = True
                    elif status_val:
                        score += 15
                        has_health_indicators = True

                    for key in ("healthy", "ok", "alive", "ready", "live"):
                        if data.get(key) is True:
                            score += 8
                            has_health_indicators = True

                    if isinstance(data.get("components"), dict):
                        score += 10
                        has_health_indicators = True
                    if isinstance(data.get("checks"), (dict, list)):
                        score += 10
                        has_health_indicators = True
                    if "uptime" in data or "version" in data:
                        score += 5
                        has_health_indicators = True

                    keys = set(k.lower() for k in data.keys())
                    health_keys = keys & {"status", "healthy", "ok", "alive", "ready", "checks", "components", "uptime"}
                    if len(health_keys) >= 2:
                        score += 10
                        has_health_indicators = True

            except (json.JSONDecodeError, TypeError):
                pass

        elif not is_html and not is_json:
            body_stripped = body.strip().lower()
            if body_stripped in ("ok", "healthy", "alive", "pong", "up", "ready"):
                score += 20
                has_health_indicators = True
            elif any(kw in body_lower for kw in HEALTH_KEYWORDS):
                score += 8
                has_health_indicators = True

    if response_time_ms is not None:
        if response_time_ms < 200:
            score += 5
        elif response_time_ms < 500:
            score += 2
        elif response_time_ms > 5000:
            score -= 5

    if body is not None and len(body) < 500:
        score += 3
    elif body is not None and len(body) > 5000:
        score -= 5

    return max(0.0, min(score, 100.0)), is_json, has_health_indicators


# ── Probing ───────────────────────────────────────────────────────────────────

async def _probe_candidate(
    client: httpx.AsyncClient, url: str, *, is_frontend_url: bool = False
) -> dict:
    start = time.monotonic()
    try:
        resp = await client.get(url, follow_redirects=True, timeout=settings.HEALTH_DISCOVERY_TIMEOUT_SECONDS)
        elapsed_ms = int((time.monotonic() - start) * 1000)
        body = resp.text[:2000]
        content_type = resp.headers.get("content-type", "")
        score, is_json, has_indicators = _score_candidate(
            url, resp.status_code, elapsed_ms, content_type, body,
            is_frontend_url=is_frontend_url,
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


# ── Main discovery flow ──────────────────────────────────────────────────────

async def discover_health_endpoints(
    db: AsyncSession, application_id: UUID, base_url: str
) -> list[HealthCandidate]:
    """Discover health endpoints by crawling, parsing specs, and probing."""
    clean_url = base_url.rstrip("/")

    # The frontend URL is the root of the app -- if it loads, the app is up.
    parsed_base = urlparse(clean_url)
    frontend_url = urlunparse(
        parsed_base._replace(path="", params="", query="", fragment="")
    ).rstrip("/")

    async with httpx.AsyncClient(
        verify=False,
        headers={"User-Agent": "InternalMonitor/1.0 HealthCheck"},
    ) as client:
        # Phase 1: actively search for paths
        discovered_paths = await _discover_paths(client, clean_url)
        logger.info(
            "discovery_search_complete",
            app_url=clean_url,
            discovered_count=len(discovered_paths),
            discovered=list(discovered_paths)[:20],
        )

        # Phase 2: build full candidate list (discovered + fallbacks)
        candidate_urls = _build_candidate_urls(clean_url, discovered_paths)
        logger.info("probing_candidates", total=len(candidate_urls))

        # Phase 3: probe all candidates concurrently.
        # The frontend (root) URL is flagged so the scorer treats it as an
        # alive-check instead of penalising it for being HTML.
        tasks = [
            _probe_candidate(
                client, url,
                is_frontend_url=(url.rstrip("/") == frontend_url),
            )
            for url in candidate_urls
        ]
        results = await asyncio.gather(*tasks)

    # Clear old candidates
    old = await db.execute(
        select(HealthCandidate).where(HealthCandidate.application_id == application_id)
    )
    for c in old.scalars().all():
        await db.delete(c)
    await db.flush()

    # Only store candidates that responded with score > 0
    candidates = []
    for r in results:
        if r["score"] > 0 or (r["http_status"] is not None and r["http_status"] < 400):
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
