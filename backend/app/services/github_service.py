"""GitHub Actions workflow dispatch service."""
from dataclasses import dataclass

import httpx

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)

GITHUB_API = "https://api.github.com"


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
