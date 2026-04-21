#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Bind Containers — maps Docker containers on the VM to registered apps
#
# Usage:
#   ./bind-containers.sh              # auto-discover and bind containers
#   ./bind-containers.sh --list       # just list all containers on the VM
#   ./bind-containers.sh --show       # show current app→container mappings
#   ./bind-containers.sh --manual     # interactive: pick containers for each app
#
# This script runs from the Mac (not inside Docker) and uses multipass to
# access the Ubuntu VM where the app containers run.
# ─────────────────────────────────────────────────────────────────────────────

# ── Configuration ─────────────────────────────────────────────────────────────
API_URL="${API_URL:-http://localhost:8090}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@company.internal}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin1234}"
VM_NAME="${VM_NAME:-ubuntu-vm}"

# ── Repo map: display name → GitHub repo name ────────────────────────────────
# Used to auto-set github_repo for each app so Redeploy works out of the box.
# Repo names are derived from URL slugs; edit if any don't match your actual repos.
declare -A REPO_MAP=(
  ["Signature IBC"]="signature-ibc"
  ["Blueprint visualizer"]="blueprint-visualizer"
  ["Portfolio"]="portfolio"
  ["Learning Path"]="skillcentral"
  ["Nvidia Blueprint Matcher"]="nvidiapass"
  ["Sally Beauty"]="sallybeauty"
  ["IBC Call Center"]="bankingcallcenter"
  ["Admission Assistant"]="admissionassistant"
  ["Asset Management"]="asset-mgmt"
  ["Effy Jewelry"]="effy"
  ["Google email/calendar chatbot"]="emailchatbot"
  ["AF videotesting"]="videotesting"
  ["CHOA"]="choa"
  ["CanChat"]="canchat"
  ["HealthChat"]="healthchat"
  ["Digital Experience"]="digitalexperience"
  ["ObservIQ"]="observeiq"
  ["Data Synth"]="datasynth"
  ["IBC Banking forecast"]="ibcbanking"
  ["Cece panelist"]="cecepanelist"
  ["QuikTrip"]="quiktrip"
  ["Data Lakehouse visualizer"]="lakehouse-visualizer"
  ["IBC CIF"]="ibccif"
  ["SecOps DTNA"]="secops"
  ["AiOps Vuln"]="ai-ops-platform"
)

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# ── Handle flags ──────────────────────────────────────────────────────────────
LIST_ONLY=false
SHOW_ONLY=false
MANUAL_MODE=false
if [[ "${1:-}" == "--list" ]]; then LIST_ONLY=true; fi
if [[ "${1:-}" == "--show" ]]; then SHOW_ONLY=true; fi
if [[ "${1:-}" == "--manual" ]]; then MANUAL_MODE=true; fi

printf "\n${BOLD}${CYAN}  ╔═══════════════════════════════════════╗${NC}\n"
printf "${BOLD}${CYAN}  ║   Bind Containers                     ║${NC}\n"
printf "${BOLD}${CYAN}  ╚═══════════════════════════════════════╝${NC}\n\n"

# ── 1. Get containers from VM ────────────────────────────────────────────────
printf "${CYAN}[1/3]${NC} Fetching containers from ${BOLD}%s${NC}...\n" "$VM_NAME"

CONTAINERS_RAW=$(multipass exec "$VM_NAME" -- docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null) || {
    printf "${RED}[FAIL]${NC} Could not connect to VM. Is multipass running?\n"
    printf "  ${DIM}Try: multipass info %s${NC}\n" "$VM_NAME"
    exit 1
}

CONTAINER_COUNT=$(echo "$CONTAINERS_RAW" | grep -c . || echo 0)
printf "${GREEN}[OK]${NC}   Found ${BOLD}%s${NC} running containers\n\n" "$CONTAINER_COUNT"

if $LIST_ONLY; then
    printf "  ${BOLD}%-40s %-40s %s${NC}\n" "CONTAINER" "IMAGE" "STATUS"
    printf "  %-40s %-40s %s\n" "────────────────────────────────────────" "────────────────────────────────────────" "──────────────────────"
    echo "$CONTAINERS_RAW" | while IFS=$'\t' read -r name image status; do
        printf "  %-40s ${DIM}%-40s${NC} %s\n" "$name" "$image" "$status"
    done
    printf "\nTotal: ${BOLD}%s${NC} containers\n\n" "$CONTAINER_COUNT"
    exit 0
fi

# ── 2. Login ─────────────────────────────────────────────────────────────────
printf "${CYAN}[2/3]${NC} Logging in to API...\n"

LOGIN_RESPONSE=$(curl -sf --max-time 10 \
    -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" 2>&1) || {
    printf "${RED}[FAIL]${NC} Could not log in at %s\n" "$API_URL"
    exit 1
}

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null) || {
    printf "${RED}[FAIL]${NC} Could not parse login response\n"
    exit 1
}
printf "${GREEN}[OK]${NC}   Authenticated\n\n"
AUTH="Authorization: Bearer $TOKEN"

# Get all registered apps
APPS_JSON=$(curl -sf --max-time 10 -H "$AUTH" "$API_URL/api/applications?limit=200" 2>/dev/null) || {
    printf "${RED}[FAIL]${NC} Could not fetch applications\n"
    exit 1
}

if $SHOW_ONLY; then
    echo "$APPS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
apps = data.get('items', [])
print(f'  {len(apps)} registered applications:\n')
print(f'  {\"APP\":<30} {\"BACKEND CONTAINER\":<35} {\"FRONTEND CONTAINER\":<35}')
print(f'  {\"─\"*30} {\"─\"*35} {\"─\"*35}')
for app in sorted(apps, key=lambda a: a['display_name']):
    be = app.get('backend_container') or '—'
    fe = app.get('frontend_container') or '—'
    print(f'  {app[\"display_name\"]:<30} {be:<35} {fe:<35}')
"
    printf "\n"
    exit 0
fi

# ── 3. Match and bind ────────────────────────────────────────────────────────
printf "${CYAN}[3/3]${NC} Matching containers to apps...\n\n"

# Build container list as a Python-parseable structure
BIND_RESULT=$(echo "$CONTAINERS_RAW" | python3 -c "
import sys, json, re

# Read containers
containers = []
for line in sys.stdin:
    parts = line.strip().split('\t')
    if len(parts) >= 2:
        containers.append({'name': parts[0], 'image': parts[1]})

# Read apps from env
apps_json = '''$APPS_JSON'''
apps = json.loads(apps_json).get('items', [])

FE_HINTS = {'frontend', 'fe', 'next', 'react', 'nginx', 'web', 'ui', 'client'}
BE_HINTS = {'backend', 'be', 'api', 'fastapi', 'flask', 'django', 'python', 'uvicorn', 'gunicorn', 'server', 'app'}

# Manual overrides for apps whose container names don't match their URL slug
SLUG_OVERRIDES = {
    'signatures-ibc': 'signature-ibc',
    'ibccif': 'ibc',
}

def slug_from_url(url):
    from urllib.parse import urlparse
    host = urlparse(url).hostname or ''
    slug = host.split('.')[0]
    slug = re.sub(r'-vm$', '', slug)
    slug = slug.lower()
    return SLUG_OVERRIDES.get(slug, slug)

def classify(name, image):
    combined = f'{name} {image}'.lower()
    fe = sum(1 for h in FE_HINTS if h in combined)
    be = sum(1 for h in BE_HINTS if h in combined)
    if fe > be: return 'frontend'
    if be > fe: return 'backend'
    return None

results = []
for app in apps:
    slug = slug_from_url(app['base_url'])
    if not slug:
        continue

    matches = [c for c in containers if slug in c['name'].lower()]
    if not matches:
        parts = slug.split('-')
        if len(parts) > 1:
            matches = [c for c in containers if all(p in c['name'].lower() for p in parts)]

    fe_name = None
    be_name = None

    for c in matches:
        role = classify(c['name'], c['image'])
        if role == 'frontend' and not fe_name:
            fe_name = c['name']
        elif role == 'backend' and not be_name:
            be_name = c['name']

    if len(matches) == 1 and not fe_name and not be_name:
        be_name = matches[0]['name']

    if not fe_name and not be_name and len(matches) >= 2:
        sorted_m = sorted(matches, key=lambda c: c['name'])
        fe_name = sorted_m[0]['name']
        be_name = sorted_m[1]['name']

    results.append({
        'id': app['id'],
        'name': app['display_name'],
        'slug': slug,
        'match_count': len(matches),
        'fe': fe_name,
        'be': be_name,
        'current_fe': app.get('frontend_container'),
        'current_be': app.get('backend_container'),
        'github_repo': app.get('github_repo') or '',
    })

print(json.dumps(results))
" 2>/dev/null) || {
    printf "${RED}[FAIL]${NC} Matching failed\n"
    exit 1
}

# Apply bindings
BOUND=0
SKIPPED=0
NO_MATCH=0

echo "$BIND_RESULT" | python3 -c "
import sys, json
results = json.loads(sys.stdin.read())
for r in results:
    print(f\"{r['id']}|{r['name']}|{r['fe'] or ''}|{r['be'] or ''}|{r['current_fe'] or ''}|{r['current_be'] or ''}|{r['match_count']}|{r['github_repo']}\")
" | while IFS='|' read -r app_id app_name new_fe new_be cur_fe cur_be match_count cur_repo; do

    # Resolve github_repo from REPO_MAP if not already set
    REPO=""
    if [[ -z "$cur_repo" ]] && [[ -n "${REPO_MAP[$app_name]+x}" ]]; then
        REPO="${REPO_MAP[$app_name]}"
    fi

    if [[ -z "$new_fe" && -z "$new_be" && -z "$REPO" ]]; then
        printf "  ${DIM}⊘ %-30s no matching containers${NC}\n" "$app_name"
        continue
    fi

    # Skip if already bound to the same containers and repo is set
    if [[ "$new_fe" == "$cur_fe" && "$new_be" == "$cur_be" && -z "$REPO" ]]; then
        printf "  ${DIM}✓ %-30s already bound${NC}" "$app_name"
        [[ -n "$cur_be" ]] && printf " ${DIM}BE:%s${NC}" "$cur_be"
        [[ -n "$cur_fe" ]] && printf " ${DIM}FE:%s${NC}" "$cur_fe"
        printf "\n"
        continue
    fi

    # Build PATCH body for containers
    BODY="{}"
    if [[ -n "$new_fe" || -n "$new_be" ]]; then
        BODY=$(python3 -c "
import json
d = {}
fe = '$new_fe'
be = '$new_be'
if fe: d['frontend_container'] = fe
if be: d['backend_container'] = be
print(json.dumps(d))
")
    fi

    # Patch containers
    if [[ -n "$new_fe" || -n "$new_be" ]]; then
        PATCH_RESP=$(curl -sf --max-time 10 \
            -X PATCH "$API_URL/api/applications/$app_id/containers" \
            -H "$AUTH" \
            -H "Content-Type: application/json" \
            -d "$BODY" 2>&1) && {
            printf "  ${GREEN}✓ %-30s${NC}" "$app_name"
            [[ -n "$new_be" ]] && printf " BE:${BOLD}%s${NC}" "$new_be"
            [[ -n "$new_fe" ]] && printf " FE:${BOLD}%s${NC}" "$new_fe"
        } || {
            printf "  ${RED}✗ %-30s container bind failed${NC}" "$app_name"
        }
    else
        printf "  ${DIM}· %-30s${NC}" "$app_name"
    fi

    # Patch github_repo if we have a new one
    if [[ -n "$REPO" ]]; then
        REPO_BODY=$(python3 -c "import json; print(json.dumps({'github_repo': '$REPO'}))")
        curl -sf --max-time 10 \
            -X PATCH "$API_URL/api/applications/$app_id" \
            -H "$AUTH" \
            -H "Content-Type: application/json" \
            -d "$REPO_BODY" >/dev/null 2>&1 && {
            printf " repo:${CYAN}%s${NC}" "$REPO"
        } || {
            printf " ${RED}repo-fail${NC}"
        }
    fi

    printf "\n"
done

# ── Summary ───────────────────────────────────────────────────────────────────
printf "\n${BOLD}── Done ──${NC}\n\n"
printf "  Run ${CYAN}./bind-containers.sh --show${NC} to see all mappings\n"
printf "  Run ${CYAN}./bind-containers.sh --list${NC} to see all VM containers\n"
printf "  Edit manually in the app detail page → Container logs → Edit\n\n"
