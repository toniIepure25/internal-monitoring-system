"""Container log access service.

Connects to the VM via SSH (asyncssh) to list Docker containers and fetch logs.
The VM host, user, and optional key path are configured via environment variables.
"""
import asyncio
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import asyncssh

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)

_SAFE_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$")

FE_HINTS = frozenset(("frontend", "fe", "next", "react", "nginx", "web", "ui", "client"))
BE_HINTS = frozenset(("backend", "be", "api", "fastapi", "flask", "django", "python", "uvicorn", "gunicorn", "server"))


@dataclass
class ContainerInfo:
    name: str
    image: str
    status: str
    ports: str


@dataclass
class ContainerMatch:
    frontend: str | None = None
    backend: str | None = None
    all_matches: list[ContainerInfo] | None = None


def _validate_container_name(name: str) -> bool:
    return bool(_SAFE_NAME.match(name))


async def _ssh_run(command: str, timeout: int = 15) -> tuple[str, str, int]:
    """Run a command on the VM via SSH."""
    try:
        key_path = settings.VM_SSH_KEY_PATH
        known_hosts = None

        connect_kwargs: dict = {
            "host": settings.VM_SSH_HOST,
            "port": settings.VM_SSH_PORT,
            "username": settings.VM_SSH_USER,
            "known_hosts": known_hosts,
        }

        if key_path and Path(key_path).exists():
            connect_kwargs["client_keys"] = [key_path]

        async with asyncssh.connect(**connect_kwargs) as conn:
            result = await asyncio.wait_for(
                conn.run(command, check=False),
                timeout=timeout,
            )
            return (
                result.stdout or "",
                result.stderr or "",
                result.exit_status or 0,
            )
    except asyncio.TimeoutError:
        logger.warning("ssh_timeout", host=settings.VM_SSH_HOST, command=command[:80])
        return "", "SSH command timed out", 1
    except asyncssh.Error as e:
        logger.error("ssh_error", host=settings.VM_SSH_HOST, error=str(e))
        return "", f"SSH error: {e}", 1
    except Exception as e:
        logger.error("ssh_connect_failed", host=settings.VM_SSH_HOST, error=str(e))
        return "", f"Connection failed: {e}", 1


async def list_containers() -> list[ContainerInfo]:
    """List all running Docker containers on the VM."""
    fmt = "{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"
    stdout, stderr, rc = await _ssh_run(f'docker ps --format "{fmt}"')
    if rc != 0:
        logger.warning("docker_ps_failed", stderr=stderr)
        return []

    containers: list[ContainerInfo] = []
    for line in stdout.strip().splitlines():
        parts = line.split("\t")
        if len(parts) >= 3:
            containers.append(ContainerInfo(
                name=parts[0],
                image=parts[1],
                status=parts[2],
                ports=parts[3] if len(parts) > 3 else "",
            ))
    return containers


def _slug_from_url(base_url: str) -> str:
    """Extract a matchable slug from a base URL.

    ``https://mtm-amplify-vm.ccrolabs.com`` -> ``mtm-amplify``
    ``https://asset-mgmt-vm.ccrolabs.com``  -> ``asset-mgmt``
    """
    host = urlparse(base_url).hostname or ""
    parts = host.split(".")
    slug = parts[0] if parts else host
    slug = re.sub(r"-vm$", "", slug)
    return slug.lower()


def _classify(name: str, image: str) -> str | None:
    """Return 'frontend', 'backend', or None based on naming hints."""
    combined = f"{name} {image}".lower()
    fe_score = sum(1 for h in FE_HINTS if h in combined)
    be_score = sum(1 for h in BE_HINTS if h in combined)
    if fe_score > be_score:
        return "frontend"
    if be_score > fe_score:
        return "backend"
    return None


async def discover_containers(base_url: str) -> ContainerMatch:
    """Match running containers to an application by URL slug."""
    slug = _slug_from_url(base_url)
    if not slug:
        return ContainerMatch()

    all_containers = await list_containers()

    matches = [c for c in all_containers if slug in c.name.lower()]

    if not matches:
        slug_parts = slug.split("-")
        if len(slug_parts) > 1:
            matches = [
                c for c in all_containers
                if all(p in c.name.lower() for p in slug_parts)
            ]

    if not matches:
        return ContainerMatch(all_matches=[])

    fe: str | None = None
    be: str | None = None

    for c in matches:
        role = _classify(c.name, c.image)
        if role == "frontend" and not fe:
            fe = c.name
        elif role == "backend" and not be:
            be = c.name

    if len(matches) == 1 and not fe and not be:
        be = matches[0].name

    if not fe and not be and len(matches) >= 2:
        sorted_matches = sorted(matches, key=lambda c: c.name)
        fe = sorted_matches[0].name
        be = sorted_matches[1].name

    return ContainerMatch(frontend=fe, backend=be, all_matches=matches)


async def fetch_logs(
    container_name: str,
    tail: int = 200,
    since: str | None = None,
) -> tuple[str, bool]:
    """Fetch the last ``tail`` log lines for a container.

    Returns (log_text, success).
    """
    if not _validate_container_name(container_name):
        return "Invalid container name", False

    cmd = f"docker logs --tail {tail} --timestamps"
    if since:
        safe_since = re.sub(r"[^0-9a-zA-Z.:TZ+_-]", "", since)
        cmd += f" --since {safe_since}"
    cmd += f" {container_name} 2>&1"

    stdout, stderr, rc = await _ssh_run(cmd, timeout=30)

    combined = stdout if stdout else stderr

    if rc != 0 and not combined.strip():
        return f"Failed to fetch logs (exit code {rc})", False

    return combined, True
