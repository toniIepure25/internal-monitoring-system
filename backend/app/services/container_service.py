"""Container log access service.

Runs commands on the VM via the configured VM_EXEC_PREFIX (default:
``multipass exec ubuntu-vm --``) to list Docker containers and fetch logs.
"""
import asyncio
import re
import shlex
from dataclasses import dataclass
from urllib.parse import urlparse

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger(__name__)

_SAFE_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$")

FE_HINTS = frozenset(("frontend", "fe", "next", "react", "nginx", "web", "ui", "client"))
BE_HINTS = frozenset(("backend", "be", "api", "fastapi", "flask", "django", "python", "uvicorn", "gunicorn", "server", "app"))


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


def _build_prefix() -> list[str]:
    return shlex.split(settings.VM_EXEC_PREFIX)


async def _exec(args: list[str], timeout: int = 15) -> tuple[str, str, int]:
    """Run a command via the VM exec prefix and return (stdout, stderr, returncode)."""
    full_cmd = _build_prefix() + args
    logger.debug("container_exec", cmd=" ".join(full_cmd))
    try:
        proc = await asyncio.create_subprocess_exec(
            *full_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return stdout.decode(errors="replace"), stderr.decode(errors="replace"), proc.returncode or 0
    except asyncio.TimeoutError:
        logger.warning("container_exec_timeout", cmd=" ".join(full_cmd))
        return "", "Command timed out", 1
    except Exception as e:
        logger.error("container_exec_error", cmd=" ".join(full_cmd), error=str(e))
        return "", str(e), 1


async def list_containers() -> list[ContainerInfo]:
    """List all running Docker containers on the VM."""
    fmt = "{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    stdout, stderr, rc = await _exec(["docker", "ps", "--format", fmt])
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

    ``https://mtm-amplify-vm.ccrolabs.com`` → ``mtm-amplify``
    ``https://asset-mgmt-vm.ccrolabs.com``  → ``asset-mgmt``
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

    # Broad match: container name contains the slug
    matches = [c for c in all_containers if slug in c.name.lower()]

    if not matches:
        # Try partial: split slug on hyphens, match if all parts appear
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

    # If only one container matched and no role was assigned, treat it as both
    if len(matches) == 1 and not fe and not be:
        be = matches[0].name

    # If two+ matched but classification failed, pick alphabetically
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

    args = ["docker", "logs", "--tail", str(tail), "--timestamps"]
    if since:
        safe_since = re.sub(r"[^0-9a-zA-Z.:TZ+_-]", "", since)
        args.extend(["--since", safe_since])
    args.append(container_name)

    stdout, stderr, rc = await _exec(args, timeout=30)

    # Docker writes some logs to stderr (especially for tty containers)
    combined = stdout + stderr if stdout else stderr

    if rc != 0 and not combined.strip():
        return f"Failed to fetch logs (exit code {rc})", False

    return combined, True
