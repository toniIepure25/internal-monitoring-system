#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Internal Monitoring System — Deploy Script
# Usage:  ./deploy.sh          (first deploy or redeploy)
#         ./deploy.sh --down   (stop and remove containers)
#         ./deploy.sh --status (show container status)
#         ./deploy.sh --logs   (tail live logs)
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_PROJECT="internal-monitoring-system"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
LATEST_LOG="$LOG_DIR/deploy-latest.log"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# ── Logging ──────────────────────────────────────────────────────────────────
# Every log call writes to both the terminal and the log file.
# The log file gets plain text (no ANSI colors).
_log_raw() {
    local stripped
    stripped=$(printf "%s" "$1" | sed 's/\x1b\[[0-9;]*m//g' 2>/dev/null || printf "%s" "$1")
    printf "%s  %s\n" "$(date +%H:%M:%S)" "$stripped" >> "$LOG_FILE"
}

info()    { local msg; msg=$(printf "${CYAN}[INFO]${NC}  %s" "$1"); printf "%s\n" "$msg"; _log_raw "$msg"; }
success() { local msg; msg=$(printf "${GREEN}[OK]${NC}    %s" "$1"); printf "%s\n" "$msg"; _log_raw "$msg"; }
warn()    { local msg; msg=$(printf "${YELLOW}[WARN]${NC}  %s" "$1"); printf "%s\n" "$msg"; _log_raw "$msg"; }
fail()    { local msg; msg=$(printf "${RED}[FAIL]${NC}  %s" "$1"); printf "%s\n" "$msg"; _log_raw "$msg"; exit 1; }
header()  { local msg; msg=$(printf "\n${BOLD}── %s ──${NC}" "$1"); printf "%s\n\n" "$msg"; _log_raw "$msg"; }

# Capture a command's full output to the log, show last N lines on terminal
run_logged() {
    local label=$1; shift
    local show_lines=${DEPLOY_SHOW_LINES:-10}
    local tmpout
    tmpout=$(mktemp)

    printf "  ${DIM}$ %s${NC}\n" "$*"
    _log_raw "CMD: $*"

    if "$@" > "$tmpout" 2>&1; then
        cat "$tmpout" >> "$LOG_FILE"
        tail -n "$show_lines" "$tmpout"
        success "$label"
        rm -f "$tmpout"
        return 0
    else
        local exit_code=$?
        cat "$tmpout" >> "$LOG_FILE"
        printf "\n"
        warn "Last 25 lines of output:"
        tail -n 25 "$tmpout"
        printf "\n"
        _log_raw "EXIT CODE: $exit_code"
        rm -f "$tmpout"
        return $exit_code
    fi
}

# Start the log
printf "Deploy started: %s\n" "$(date)" > "$LOG_FILE"
printf "Working directory: %s\n" "$SCRIPT_DIR" >> "$LOG_FILE"
printf "User: %s@%s\n" "$(whoami)" "$(hostname)" >> "$LOG_FILE"
printf "OS: %s %s\n\n" "$(uname -s)" "$(uname -r)" >> "$LOG_FILE"
ln -sf "$LOG_FILE" "$LATEST_LOG"

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
info "Log file: ${DIM}${LOG_FILE}${NC}"

# ── 1. Prerequisites ────────────────────────────────────────────────────────
header "Checking prerequisites"

command -v git >/dev/null 2>&1 \
    && success "git $(git --version | awk '{print $3}')" \
    || fail "git is not installed"

command -v docker >/dev/null 2>&1 \
    && success "docker $(docker --version | awk '{print $3}' | tr -d ',')" \
    || fail "Docker is not installed — https://docs.docker.com/get-docker/"

if ! docker info >/dev/null 2>&1; then
    warn "Docker daemon is not responding — attempting restart..."
    if [[ "$(uname)" == "Darwin" ]]; then
        killall Docker 2>/dev/null || true
        sleep 2
        open -a Docker
        info "Waiting for Docker Desktop to start (up to 60s)..."
        DOCKER_WAIT=0
        while ! docker info >/dev/null 2>&1; do
            sleep 3
            DOCKER_WAIT=$((DOCKER_WAIT + 3))
            if [[ $DOCKER_WAIT -ge 60 ]]; then
                fail "Docker daemon did not start after 60s — open Docker Desktop manually"
            fi
            printf "  ${DIM}waiting... %ds${NC}\n" "$DOCKER_WAIT"
        done
        success "Docker Desktop restarted"
    else
        fail "Docker daemon is not running — start Docker first"
    fi
fi

# Verify the daemon is actually healthy (catches 500 errors on the socket)
DOCKER_PING=$(docker system info --format '{{.ServerVersion}}' 2>&1) || true
if [[ -z "$DOCKER_PING" ]] || echo "$DOCKER_PING" | grep -qi "error\|500"; then
    warn "Docker daemon returned an error — restarting Docker Desktop..."
    if [[ "$(uname)" == "Darwin" ]]; then
        killall Docker 2>/dev/null || true
        sleep 3
        open -a Docker
        info "Waiting for Docker Desktop to recover (up to 90s)..."
        DOCKER_WAIT=0
        while true; do
            sleep 5
            DOCKER_WAIT=$((DOCKER_WAIT + 5))
            if docker system info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
                break
            fi
            if [[ $DOCKER_WAIT -ge 90 ]]; then
                fail "Docker daemon still unhealthy after restart — check Docker Desktop"
            fi
            printf "  ${DIM}waiting... %ds${NC}\n" "$DOCKER_WAIT"
        done
        success "Docker Desktop recovered ($(docker system info --format '{{.ServerVersion}}' 2>/dev/null))"
    else
        fail "Docker daemon is unhealthy — restart Docker and try again"
    fi
else
    success "Docker daemon healthy (engine $DOCKER_PING)"
fi

docker compose version >/dev/null 2>&1 \
    && success "docker compose $(docker compose version --short)" \
    || fail "Docker Compose v2 is required — https://docs.docker.com/compose/install/"

command -v curl >/dev/null 2>&1 \
    && success "curl available" \
    || warn "curl not found — health checks will be skipped"

# On macOS, Docker Desktop credential helpers break in SSH / non-interactive sessions.
# Copy the real config (preserves context/socket settings) but strip credential fields.
USE_CLEAN_DOCKER_CONFIG=false
if [[ "$(uname)" == "Darwin" ]]; then
    ORIG_DOCKER_CONFIG="${HOME}/.docker/config.json"
    CLEAN_DOCKER_DIR="$SCRIPT_DIR/.docker-build-config"
    mkdir -p "$CLEAN_DOCKER_DIR"
    if [[ -f "$ORIG_DOCKER_CONFIG" ]]; then
        # Copy the original, then blank out credsStore and remove credHelpers
        cp "$ORIG_DOCKER_CONFIG" "$CLEAN_DOCKER_DIR/config.json"
        sed -i '' 's/"credsStore"[[:space:]]*:[[:space:]]*"[^"]*"/"credsStore": ""/g' "$CLEAN_DOCKER_DIR/config.json"
        # Remove credHelpers block (single or multi-line)
        python3 -c "
import json, sys
p = '$CLEAN_DOCKER_DIR/config.json'
with open(p) as f: d = json.load(f)
d.pop('credHelpers', None)
d['credsStore'] = ''
with open(p, 'w') as f: json.dump(d, f, indent=2)
" 2>/dev/null || true
        USE_CLEAN_DOCKER_CONFIG=true
        success "Prepared credential-free Docker config for builds"
    else
        info "No Docker config found at $ORIG_DOCKER_CONFIG — using defaults"
    fi
fi

# ── 2. Pull latest code ─────────────────────────────────────────────────────
header "Pulling latest code"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    BRANCH=$(git branch --show-current)
    info "Branch: $BRANCH"
    info "Latest commit: $(git log -1 --format='%h %s')"

    if git diff --quiet && git diff --cached --quiet; then
        run_logged "Pulled latest from origin/$BRANCH" git pull --ff-only origin "$BRANCH" \
            || warn "Pull failed — continuing with local code"
    else
        warn "Uncommitted changes detected — skipping git pull"
        info "Changed files:"
        git status --short | while read -r line; do printf "    %s\n" "$line"; done
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
else
    success "All required env vars are set"
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
BUILD_START=$(date +%s)

if [[ "$USE_CLEAN_DOCKER_CONFIG" == true ]]; then
    run_logged "Docker images built" env DOCKER_CONFIG="$CLEAN_DOCKER_DIR" docker compose build --parallel \
        || fail "Docker build failed — check the log: $LOG_FILE"
else
    run_logged "Docker images built" docker compose build --parallel \
        || fail "Docker build failed — check the log: $LOG_FILE"
fi

BUILD_END=$(date +%s)
info "Build completed in $((BUILD_END - BUILD_START))s"

info "Starting containers..."
run_logged "Containers started" docker compose up -d \
    || fail "Failed to start containers — check the log: $LOG_FILE"

# Show container status right after start
info "Container status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps

# ── 6. Health checks ────────────────────────────────────────────────────────
header "Waiting for services to be healthy"

check_health() {
    local service=$1
    local url=$2
    local max_attempts=$3
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        printf "  ${CYAN}%-12s${NC} attempt %d/%d ... " "$service" "$attempt" "$max_attempts"

        local http_code
        http_code=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

        if [[ "$http_code" =~ ^2 ]]; then
            printf "${GREEN}healthy (HTTP %s)${NC}\n" "$http_code"
            _log_raw "$service healthy (HTTP $http_code) on attempt $attempt"
            return 0
        fi

        printf "${YELLOW}waiting (HTTP %s)${NC}\n" "$http_code"
        _log_raw "$service not ready (HTTP $http_code) attempt $attempt/$max_attempts"
        sleep 3
        attempt=$((attempt + 1))
    done

    printf "  ${CYAN}%-12s${NC} ${RED}did not become healthy after %d attempts${NC}\n" "$service" "$max_attempts"
    _log_raw "$service FAILED health check after $max_attempts attempts"

    # Dump container logs for the failing service to help debug
    warn "Recent logs for $service:"
    docker compose logs --tail 20 "$(echo "$service" | tr '[:upper:]' '[:lower:]')" 2>/dev/null | tail -20
    return 1
}

ALL_HEALTHY=true

check_health "backend" "http://localhost:8090/docs" 20 || ALL_HEALTHY=false
check_health "frontend" "http://localhost:3040" 30 || ALL_HEALTHY=false

# ── 7. Summary ───────────────────────────────────────────────────────────────
header "Deploy complete"

docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps

printf "\n"
if [[ "$ALL_HEALTHY" == true ]]; then
    printf "  ${GREEN}${BOLD}All services are up and healthy${NC}\n\n"
    _log_raw "DEPLOY SUCCESS — all services healthy"
else
    printf "  ${YELLOW}${BOLD}Some services may still be starting — check logs with:${NC}\n"
    printf "  ${CYAN}./deploy.sh --logs${NC}\n\n"
    _log_raw "DEPLOY PARTIAL — some health checks failed"
fi

DEPLOY_END=$(date +%s)
TOTAL_SECS=$((DEPLOY_END - BUILD_START))

printf "  ${BOLD}%-18s${NC} %-30s %s\n" "Service" "Local" "Cloudflare"
printf "  %-18s %-30s %s\n"   "──────────────────" "──────────────────────────────" "──────────────────────────────────────"
printf "  ${BOLD}%-18s${NC} %-30s ${CYAN}%s${NC}\n" "Frontend"  "http://localhost:3040"      "https://monitoring-system.ccrolabs.com"
printf "  ${BOLD}%-18s${NC} %-30s ${CYAN}%s${NC}\n" "Backend API"  "http://localhost:8090"   "https://monitoring-system-api.ccrolabs.com"
printf "  ${BOLD}%-18s${NC} %-30s\n"                 "API Docs"  "http://localhost:8090/docs"
printf "\n"
printf "  ${BOLD}Demo login${NC}      admin@company.internal / admin1234\n"
printf "  ${BOLD}Total time${NC}      ${TOTAL_SECS}s\n"
printf "  ${BOLD}Full log${NC}        ${DIM}%s${NC}\n\n" "$LOG_FILE"
printf "  ${CYAN}Useful commands:${NC}\n"
printf "    ./deploy.sh --status    Container status\n"
printf "    ./deploy.sh --logs      Tail live logs\n"
printf "    ./deploy.sh --down      Stop everything\n"
printf "    ./deploy.sh             Redeploy / update\n\n"
