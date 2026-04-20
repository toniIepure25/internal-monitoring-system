#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Internal Monitoring System — Deploy Script
# Usage:  sh deploy.sh          (first deploy or redeploy)
#         sh deploy.sh --down   (stop and remove containers)
#         sh deploy.sh --status (show container status)
#         sh deploy.sh --logs   (tail live logs)
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_PROJECT="internal-monitoring-system"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { printf "${CYAN}[INFO]${NC}  %s\n" "$1"; }
success() { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()    { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
fail()    { printf "${RED}[FAIL]${NC}  %s\n" "$1"; exit 1; }
header()  { printf "\n${BOLD}── %s ──${NC}\n\n" "$1"; }

# ── Handle flags ─────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--down" ]]; then
    header "Stopping containers"
    docker compose down
    success "All containers stopped"
    exit 0
fi

if [[ "${1:-}" == "--status" ]]; then
    header "Container status"
    docker compose ps
    exit 0
fi

if [[ "${1:-}" == "--logs" ]]; then
    docker compose logs -f --tail 80
    exit 0
fi

# ── Banner ───────────────────────────────────────────────────────────────────
printf "\n${BOLD}${CYAN}"
printf "  ╔══════════════════════════════════════════╗\n"
printf "  ║   Internal Monitoring System — Deploy    ║\n"
printf "  ╚══════════════════════════════════════════╝\n"
printf "${NC}\n"

# ── 1. Prerequisites ────────────────────────────────────────────────────────
header "Checking prerequisites"

command -v git >/dev/null 2>&1 \
    && success "git $(git --version | awk '{print $3}')" \
    || fail "git is not installed"

command -v docker >/dev/null 2>&1 \
    && success "docker $(docker --version | awk '{print $3}' | tr -d ',')" \
    || fail "Docker is not installed — https://docs.docker.com/get-docker/"

docker info >/dev/null 2>&1 \
    || fail "Docker daemon is not running — start Docker Desktop first"

docker compose version >/dev/null 2>&1 \
    && success "docker compose $(docker compose version --short)" \
    || fail "Docker Compose v2 is required — https://docs.docker.com/compose/install/"

# On macOS, Docker Desktop credential helpers break in SSH / non-interactive sessions.
# We prepare a clean config used ONLY for the build step (not globally, to avoid breaking
# docker compose commands that need the daemon context).
USE_CLEAN_DOCKER_CONFIG=false
if [[ "$(uname)" == "Darwin" ]]; then
    CLEAN_DOCKER_DIR="$SCRIPT_DIR/.docker-build-config"
    mkdir -p "$CLEAN_DOCKER_DIR"
    echo '{}' > "$CLEAN_DOCKER_DIR/config.json"
    USE_CLEAN_DOCKER_CONFIG=true
    success "Prepared clean Docker config (bypasses macOS keychain for builds)"
fi

# ── 2. Pull latest code ─────────────────────────────────────────────────────
header "Pulling latest code"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    BRANCH=$(git branch --show-current)
    info "Branch: ${BOLD}$BRANCH${NC}"

    if git diff --quiet && git diff --cached --quiet; then
        git pull --ff-only origin "$BRANCH" && success "Pulled latest from origin/$BRANCH" \
            || warn "Pull failed — continuing with local code"
    else
        warn "Uncommitted changes detected — skipping git pull"
    fi
else
    warn "Not a git repository — skipping pull"
fi

# ── 3. Environment file ─────────────────────────────────────────────────────
header "Checking environment"

if [[ -f "$ENV_FILE" ]]; then
    success ".env file exists"
else
    if [[ -f "$ENV_EXAMPLE" ]]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        warn ".env created from .env.example — review and edit if needed"
    else
        fail "No .env or .env.example found"
    fi
fi

# Generate a real SECRET_KEY if it's still the placeholder
if grep -q "change-me-to-a-random-64-char-string" "$ENV_FILE" 2>/dev/null; then
    NEW_KEY=$(openssl rand -hex 32 2>/dev/null || LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 64)
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s/change-me-to-a-random-64-char-string/$NEW_KEY/" "$ENV_FILE"
    else
        sed -i "s/change-me-to-a-random-64-char-string/$NEW_KEY/" "$ENV_FILE"
    fi
    success "Generated random SECRET_KEY"
fi

REQUIRED_VARS=(DATABASE_URL REDIS_URL SECRET_KEY NEXT_PUBLIC_API_URL)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=.\+" "$ENV_FILE" 2>/dev/null; then
        MISSING+=("$var")
    fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    warn "These .env variables are empty or missing: ${MISSING[*]}"
    warn "Edit .env before proceeding if needed"
fi

# ── 4. Check current state ──────────────────────────────────────────────────
header "Checking running containers"

RUNNING=$(docker compose ps --status running -q 2>/dev/null | wc -l | tr -d ' ')

if [[ "$RUNNING" -gt 0 ]]; then
    info "$RUNNING container(s) already running"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
    printf "\n"
    info "Rebuilding and restarting..."
    docker compose down
    success "Stopped existing containers"
else
    info "No containers running — fresh deploy"
fi

# ── 5. Build & deploy ───────────────────────────────────────────────────────
header "Building and deploying"

info "Building images (this may take a few minutes on first run)..."
if [[ "$USE_CLEAN_DOCKER_CONFIG" == true ]]; then
    DOCKER_CONFIG="$CLEAN_DOCKER_DIR" docker compose build --parallel 2>&1 | tail -5
else
    docker compose build --parallel 2>&1 | tail -5
fi

info "Starting containers..."
docker compose up -d

success "Containers started"

# ── 6. Health checks ────────────────────────────────────────────────────────
header "Waiting for services to be healthy"

check_health() {
    local service=$1
    local url=$2
    local max_attempts=$3
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        printf "  ${CYAN}%-12s${NC} attempt %d/%d ... " "$service" "$attempt" "$max_attempts"

        if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
            printf "${GREEN}healthy${NC}\n"
            return 0
        fi

        printf "${YELLOW}waiting${NC}\n"
        sleep 3
        attempt=$((attempt + 1))
    done

    printf "  ${CYAN}%-12s${NC} ${RED}did not become healthy after %d attempts${NC}\n" "$service" "$max_attempts"
    return 1
}

ALL_HEALTHY=true

check_health "Backend" "http://localhost:8090/docs" 20 || ALL_HEALTHY=false
check_health "Frontend" "http://localhost:3040" 30 || ALL_HEALTHY=false

# ── 7. Summary ───────────────────────────────────────────────────────────────
header "Deploy complete"

docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps

printf "\n"
if [[ "$ALL_HEALTHY" == true ]]; then
    printf "  ${GREEN}${BOLD}All services are up and healthy${NC}\n\n"
else
    printf "  ${YELLOW}${BOLD}Some services may still be starting — check logs with:${NC}\n"
    printf "  ${CYAN}sh deploy.sh --logs${NC}\n\n"
fi

printf "  ${BOLD}%-18s${NC} %-30s %s\n" "Service" "Local" "Cloudflare"
printf "  %-18s %-30s %s\n"   "──────────────────" "──────────────────────────────" "──────────────────────────────────────"
printf "  ${BOLD}%-18s${NC} %-30s ${CYAN}%s${NC}\n" "Frontend"  "http://localhost:3040"      "https://monitoring-system.ccrolabs.com"
printf "  ${BOLD}%-18s${NC} %-30s ${CYAN}%s${NC}\n" "Backend API"  "http://localhost:8090"   "https://monitoring-system-api.ccrolabs.com"
printf "  ${BOLD}%-18s${NC} %-30s\n"                 "API Docs"  "http://localhost:8090/docs"
printf "\n"
printf "  ${BOLD}Demo login${NC}      admin@company.internal / admin1234\n\n"
printf "  ${CYAN}Useful commands:${NC}\n"
printf "    sh deploy.sh --status    Container status\n"
printf "    sh deploy.sh --logs      Tail live logs\n"
printf "    sh deploy.sh --down      Stop everything\n"
printf "    sh deploy.sh             Redeploy / update\n\n"
