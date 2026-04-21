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
    error: str | None = None


async def detect_repo(base_url: str) -> RepoDetectionResult:
    """Search the org's repos for one matching the app's URL slug."""
    token = settings.GITHUB_TOKEN
    org = settings.GITHUB_ORG

    if not token:
        return RepoDetectionResult(error="GitHub token not configured")

    slug = _slug_from_url(base_url)
    if not slug:
        return RepoDetectionResult(error="Could not derive slug from URL")

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    try:
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
                    return RepoDetectionResult(
                        error=f"GitHub API returned {resp.status_code}"
                    )
                batch = resp.json()
                if not batch:
                    break
                all_repos.extend(batch)
                if len(batch) < 100:
                    break
                page += 1

        slug_parts = set(slug.split("-"))
        matches: list[RepoMatch] = []

        for repo in all_repos:
            name = repo["name"].lower()
            score = 0.0

            if name == slug:
                score = 100.0
            elif slug in name or name in slug:
                score = 70.0
            else:
                repo_parts = set(name.split("-"))
                overlap = slug_parts & repo_parts
                if overlap and len(overlap) >= len(slug_parts) * 0.5:
                    score = 40.0 + (len(overlap) / max(len(slug_parts), len(repo_parts))) * 30

            if score > 0:
                matches.append(RepoMatch(
                    name=repo["name"],
                    url=repo["html_url"],
                    score=round(score, 1),
                ))

        matches.sort(key=lambda m: m.score, reverse=True)
        best = matches[0].name if matches and matches[0].score >= 40 else None

        return RepoDetectionResult(matches=matches[:5], best=best)

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
