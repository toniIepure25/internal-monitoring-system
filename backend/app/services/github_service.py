"""GitHub Actions workflow dispatch service."""
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)

GITHUB_API = "https://api.github.com"

_SLUG_OVERRIDES = {
    "signatures-ibc": "signature-ibc",
    "ibccif": "ibc",
    "mtm-amplify": "mtm-amplify",
}


def _slug_from_url(base_url: str) -> str:
    host = urlparse(base_url).hostname or ""
    slug = host.split(".")[0]
    slug = re.sub(r"-vm$", "", slug)
    slug = slug.lower()
    return _SLUG_OVERRIDES.get(slug, slug)


@dataclass
class RepoMatch:
    name: str
    url: str
    score: float


@dataclass
class RepoDetectionResult:
    matches: list[RepoMatch] = field(default_factory=list)
    best: str | None = None
    all_repos: list[RepoMatch] = field(default_factory=list)
    error: str | None = None


async def _fetch_org_repos() -> tuple[list[dict], str | None]:
    """Fetch all repos from the configured org. Returns (repos, error)."""
    token = settings.GITHUB_TOKEN
    org = settings.GITHUB_ORG

    if not token:
        return [], "GitHub token not configured"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    all_repos: list[dict] = []
    page = 1
    async with httpx.AsyncClient() as client:
        while True:
            resp = await client.get(
                f"{GITHUB_API}/orgs/{org}/repos",
                params={"per_page": 100, "page": page, "type": "all"},
                headers=headers,
                timeout=15,
            )
            if resp.status_code != 200:
                return [], f"GitHub API returned {resp.status_code}"
            batch = resp.json()
            if not batch:
                break
            all_repos.extend(batch)
            if len(batch) < 100:
                break
            page += 1

    return all_repos, None


def _normalize(text: str) -> str:
    """Lowercase, strip common suffixes, collapse separators."""
    t = text.lower().strip()
    for suffix in ("-vm", "-poc", "-app", "-demo", "-chatbot", "-chat"):
        if t.endswith(suffix):
            t = t[: -len(suffix)]
    return re.sub(r"[-_ ]+", "", t)


def _score_repo(repo_name: str, slug: str, display_name: str) -> float:
    """Score a repo name against both the URL slug and display name."""
    name_lower = repo_name.lower()
    norm_repo = _normalize(repo_name)
    norm_slug = _normalize(slug)
    norm_display = _normalize(display_name)

    # Exact match on slug
    if name_lower == slug:
        return 100.0

    # Normalized exact match
    if norm_repo == norm_slug or norm_repo == norm_display:
        return 95.0

    best = 0.0

    # Substring containment (either direction)
    for term in [slug, _normalize(slug)]:
        if term in name_lower or name_lower in term:
            best = max(best, 75.0)
        if term in norm_repo or norm_repo in term:
            best = max(best, 70.0)

    # Display name containment
    if norm_display and (norm_display in norm_repo or norm_repo in norm_display):
        best = max(best, 65.0)

    # Word-part overlap (slug parts vs repo parts)
    slug_parts = set(slug.split("-"))
    display_parts = set(re.sub(r"[^a-z0-9]+", " ", display_name.lower()).split())
    repo_parts = set(name_lower.split("-"))

    for search_parts, base_score in [(slug_parts, 50.0), (display_parts, 40.0)]:
        if not search_parts:
            continue
        overlap = search_parts & repo_parts
        if overlap:
            ratio = len(overlap) / max(len(search_parts), len(repo_parts))
            best = max(best, base_score + ratio * 30)

    return round(best, 1)


async def detect_repo(base_url: str, display_name: str = "") -> RepoDetectionResult:
    """Search the org's repos for one matching the app's URL slug or display name."""
    slug = _slug_from_url(base_url)
    if not slug:
        return RepoDetectionResult(error="Could not derive slug from URL")

    try:
        all_repos, error = await _fetch_org_repos()
        if error:
            return RepoDetectionResult(error=error)

        scored: list[RepoMatch] = []
        all_repo_list: list[RepoMatch] = []

        for repo in all_repos:
            rm = RepoMatch(
                name=repo["name"],
                url=repo["html_url"],
                score=0.0,
            )
            all_repo_list.append(RepoMatch(name=repo["name"], url=repo["html_url"], score=0.0))

            score = _score_repo(repo["name"], slug, display_name)
            if score > 0:
                rm.score = score
                scored.append(rm)

        scored.sort(key=lambda m: m.score, reverse=True)
        all_repo_list.sort(key=lambda m: m.name.lower())

        best = scored[0].name if scored and scored[0].score >= 50 else None

        return RepoDetectionResult(
            matches=scored[:8],
            best=best,
            all_repos=all_repo_list,
        )

    except Exception as e:
        logger.error("detect_repo_error", slug=slug, error=str(e))
        return RepoDetectionResult(error=str(e))


@dataclass
class WorkflowResult:
    success: bool
    message: str
    actions_url: str | None = None


async def trigger_workflow(
    repo: str,
    ref: str = "main",
    environment: str = "VM",
    workflow_file: str = "ci.yml",
) -> WorkflowResult:
    """Trigger a GitHub Actions workflow_dispatch event.

    Returns a WorkflowResult with success status and a link to the Actions page.
    """
    token = settings.GITHUB_TOKEN
    org = settings.GITHUB_ORG

    if not token:
        return WorkflowResult(
            success=False,
            message="GitHub token not configured. Add GITHUB_TOKEN to .env",
        )

    if not repo:
        return WorkflowResult(
            success=False,
            message="No GitHub repo configured for this application",
        )

    url = f"{GITHUB_API}/repos/{org}/{repo}/actions/workflows/{workflow_file}/dispatches"
    actions_url = f"https://github.com/{org}/{repo}/actions"

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    payload = {
        "ref": ref,
        "inputs": {
            "environment": environment,
        },
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers, timeout=15)

        if resp.status_code == 204:
            logger.info(
                "workflow_dispatched",
                repo=f"{org}/{repo}",
                ref=ref,
                environment=environment,
            )
            return WorkflowResult(
                success=True,
                message=f"Deployment triggered for {repo} ({environment})",
                actions_url=actions_url,
            )

        body = resp.text[:500]
        logger.warning(
            "workflow_dispatch_failed",
            repo=f"{org}/{repo}",
            status=resp.status_code,
            body=body,
        )

        if resp.status_code == 404:
            return WorkflowResult(
                success=False,
                message=f"Workflow not found. Check that {org}/{repo} exists and has {workflow_file}",
                actions_url=actions_url,
            )
        if resp.status_code == 422:
            return WorkflowResult(
                success=False,
                message=f"Workflow dispatch rejected. Ensure '{ref}' branch exists and workflow has workflow_dispatch trigger",
                actions_url=actions_url,
            )

        return WorkflowResult(
            success=False,
            message=f"GitHub API returned {resp.status_code}: {body}",
            actions_url=actions_url,
        )

    except httpx.TimeoutException:
        return WorkflowResult(success=False, message="GitHub API request timed out")
    except Exception as e:
        logger.error("workflow_dispatch_error", repo=f"{org}/{repo}", error=str(e))
        return WorkflowResult(success=False, message=f"Request failed: {e}")
