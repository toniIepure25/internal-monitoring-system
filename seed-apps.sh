#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Seed Applications — registers apps and auto-discovers health endpoints
#
# Usage:
#   ./seed-apps.sh                  # seed all apps below (skips existing)
#   ./seed-apps.sh --reseed         # delete all seeded apps & re-register
#   ./seed-apps.sh --rediscover     # keep apps but re-run discovery on all
#   ./seed-apps.sh --dry-run        # just print what would be registered
#   ./seed-apps.sh --check          # check which apps are already registered
#
# Add your apps to the APPS array below. Format:
#   "Display Name|https://your-app-url.example.com"
#
# The script will:
#   1. Log in with the admin account
#   2. Register each app (skips duplicates)
#   3. Run health endpoint discovery on each new app
#   4. Print a summary of what was found
# ─────────────────────────────────────────────────────────────────────────────

# ── Configuration ─────────────────────────────────────────────────────────────
API_URL="${API_URL:-http://localhost:8090}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@company.internal}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin1234}"

# ── Your applications ─────────────────────────────────────────────────────────
# Add one line per app: "Display Name|https://base-url"
# Don't worry about health URLs — discovery will find them automatically.
APPS=(
  "MTM Amplify|https://mtm-amplify-vm.ccrolabs.com"
  "Signature IBC|https://signatures-ibc-vm.ccrolabs.com"
  "Blueprint Visualizer|https://blueprint-visualizer-vm.ccrolabs.com"
  "Portfolio|https://portfolio-vm.ccrolabs.com"
  "Learning Path|https://skillcentral-vm.ccrolabs.com"
  "Nvidia Blueprint Matcher|https://nvidiapass-vm.ccrolabs.com"
  "Sally Beauty|https://sallybeauty-vm.ccrolabs.com"
  "IBC Call Center|https://bankingcallcenter-vm.ccrolabs.com"
  "Admission Assistant|https://admissionassistant-vm.ccrolabs.com"
  "Asset Management|https://asset-mgmt-vm.ccrolabs.com"
  "Effy Jewelry|https://effy-vm.ccrolabs.com"
  "Google Email/Calendar Chatbot|https://emailchatbot-vm.ccrolabs.com"
  "AF Video Testing|https://videotesting-vm.ccrolabs.com"
  "CHOA|https://choa-vm.ccrolabs.com"
  "CanChat|https://canchat-vm.ccrolabs.com"
  "HealthChat|https://healthchat-vm.ccrolabs.com"
  "Digital Experience|https://digitalexperience-vm.ccrolabs.com"
  "ObservIQ|https://observeiq-vm.ccrolabs.com"
  "Data Synth|https://datasynth-vm.ccrolabs.com"
  "IBC Banking Forecast|https://ibcbanking-vm.ccrolabs.com"
  "CeCe Panelist|https://cecepanelist-vm.ccrolabs.com"
  "QuikTrip|https://quiktrip-vm.ccrolabs.com"
  "Data Lakehouse Visualizer|https://lakehouse-visualizer-vm.ccrolabs.com"
  "IBC CIF|https://ibccif-vm.ccrolabs.com"
  "SecOps DTNA|https://secops-vm.ccrolabs.com"
  "AiOps Vuln|https://ai-ops-platform-vm.ccrolabs.com"
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
DRY_RUN=false
CHECK_ONLY=false
RESEED=false
REDISCOVER=false
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=true; fi
if [[ "${1:-}" == "--check" ]]; then CHECK_ONLY=true; fi
if [[ "${1:-}" == "--reseed" ]]; then RESEED=true; fi
if [[ "${1:-}" == "--rediscover" ]]; then REDISCOVER=true; fi

printf "\n${BOLD}${CYAN}  ╔═══════════════════════════════════════╗${NC}\n"
printf "${BOLD}${CYAN}  ║   Seed Applications                   ║${NC}\n"
printf "${BOLD}${CYAN}  ╚═══════════════════════════════════════╝${NC}\n\n"

if $DRY_RUN; then
    printf "${YELLOW}[DRY RUN]${NC} Would register these apps against ${BOLD}%s${NC}:\n\n" "$API_URL"
    for entry in "${APPS[@]}"; do
        IFS='|' read -r name url <<< "$entry"
        printf "  • ${BOLD}%-30s${NC} %s\n" "$name" "$url"
    done
    printf "\nTotal: ${BOLD}%d${NC} apps\n\n" "${#APPS[@]}"
    exit 0
fi

# ── 1. Login ──────────────────────────────────────────────────────────────────
printf "${CYAN}[1/4]${NC} Logging in as ${BOLD}%s${NC}...\n" "$ADMIN_EMAIL"

LOGIN_RESPONSE=$(curl -sf --max-time 10 \
    -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" 2>&1) || {
    printf "${RED}[FAIL]${NC} Could not log in. Is the backend running at %s?\n" "$API_URL"
    printf "${DIM}  Response: %s${NC}\n" "$LOGIN_RESPONSE"
    exit 1
}

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null) || {
    printf "${RED}[FAIL]${NC} Could not parse login response\n"
    exit 1
}
printf "${GREEN}[OK]${NC}   Authenticated\n\n"

AUTH="Authorization: Bearer $TOKEN"

# ── 2. Check existing apps ────────────────────────────────────────────────────
printf "${CYAN}[2/4]${NC} Checking existing applications...\n"

EXISTING=$(curl -sf --max-time 10 \
    -H "$AUTH" \
    "$API_URL/api/applications?limit=200" 2>/dev/null) || EXISTING='{"items":[]}'

EXISTING_URLS=$(echo "$EXISTING" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for app in data.get('items', []):
    print(app.get('base_url', '').rstrip('/').lower())
" 2>/dev/null)

EXISTING_COUNT=$(echo "$EXISTING" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('items',[])))" 2>/dev/null || echo "0")
printf "${GREEN}[OK]${NC}   Found ${BOLD}%s${NC} existing apps\n\n" "$EXISTING_COUNT"

if $CHECK_ONLY; then
    printf "Existing apps:\n"
    echo "$EXISTING" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for app in data.get('items', []):
    status = app.get('status', {}) or {}
    state = status.get('status', 'UNKNOWN')
    health = app.get('health_url', 'none')
    print(f\"  • {app['display_name']:<30} {state:<8} {app['base_url']}\")
    print(f\"    Health: {health}\")
" 2>/dev/null
    printf "\nWould seed:\n"
    for entry in "${APPS[@]}"; do
        IFS='|' read -r name url <<< "$entry"
        url_lower=$(echo "$url" | tr '[:upper:]' '[:lower:]' | sed 's:/*$::')
        if echo "$EXISTING_URLS" | grep -qF "$url_lower"; then
            printf "  ${DIM}• %-30s %s (already exists)${NC}\n" "$name" "$url"
        else
            printf "  ${GREEN}• %-30s %s (new)${NC}\n" "$name" "$url"
        fi
    done
    printf "\n"
    exit 0
fi

# ── 2b. --reseed: delete existing seeded apps ────────────────────────────────
if $RESEED; then
    printf "${YELLOW}[RESEED]${NC} Deleting existing seeded apps so they can be re-registered...\n\n"

    EXISTING_JSON=$(echo "$EXISTING" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for app in data.get('items', []):
    print(json.dumps({'id': app['id'], 'base_url': app.get('base_url','').rstrip('/').lower(), 'name': app['display_name']}))
" 2>/dev/null)

    DELETED=0
    for entry in "${APPS[@]}"; do
        IFS='|' read -r name url <<< "$entry"
        url_lower=$(echo "$url" | tr '[:upper:]' '[:lower:]' | sed 's:/*$::')

        APP_ID=$(echo "$EXISTING_JSON" | python3 -c "
import sys, json
target = '$url_lower'
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    app = json.loads(line)
    if app['base_url'] == target:
        print(app['id'])
        break
" 2>/dev/null)

        if [[ -n "$APP_ID" ]]; then
            DEL_RESP=$(curl -sf --max-time 10 \
                -X DELETE "$API_URL/api/applications/$APP_ID" \
                -H "$AUTH" 2>&1) && {
                printf "  ${RED}✗ %-30s${NC} deleted (id: ${DIM}%s${NC})\n" "$name" "$APP_ID"
                DELETED=$((DELETED + 1))
            } || {
                printf "  ${YELLOW}⚠ %-30s${NC} delete failed\n" "$name"
            }
        fi
    done

    printf "\n  Deleted ${BOLD}%d${NC} apps. Re-registering...\n\n" "$DELETED"
    EXISTING_URLS=""
fi

# ── 2c. --rediscover: re-run discovery on existing apps ─────────────────────
if $REDISCOVER; then
    printf "${CYAN}[REDISCOVER]${NC} Triggering fresh discovery on all existing seeded apps...\n\n"

    EXISTING_JSON=$(echo "$EXISTING" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for app in data.get('items', []):
    print(json.dumps({'id': app['id'], 'base_url': app.get('base_url','').rstrip('/').lower(), 'name': app['display_name']}))
" 2>/dev/null)

    REDISCOVERED_IDS=()
    for entry in "${APPS[@]}"; do
        IFS='|' read -r name url <<< "$entry"
        url_lower=$(echo "$url" | tr '[:upper:]' '[:lower:]' | sed 's:/*$::')

        APP_ID=$(echo "$EXISTING_JSON" | python3 -c "
import sys, json
target = '$url_lower'
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    app = json.loads(line)
    if app['base_url'] == target:
        print(app['id'])
        break
" 2>/dev/null)

        if [[ -n "$APP_ID" ]]; then
            DISC_RESP=$(curl -sf --max-time 15 \
                -X POST "$API_URL/api/applications/$APP_ID/rediscover" \
                -H "$AUTH" 2>&1) && {
                printf "  ${GREEN}↻ %-30s${NC} discovery queued\n" "$name"
                REDISCOVERED_IDS+=("$APP_ID|$name")
            } || {
                printf "  ${YELLOW}⚠ %-30s${NC} rediscover failed\n" "$name"
            }
        else
            printf "  ${DIM}⊘ %-30s not registered yet${NC}\n" "$name"
        fi
    done

    if [[ ${#REDISCOVERED_IDS[@]} -gt 0 ]]; then
        printf "\n  ${DIM}Waiting 15 seconds for discovery to complete...${NC}\n\n"
        sleep 15

        for entry in "${REDISCOVERED_IDS[@]}"; do
            IFS='|' read -r app_id app_name <<< "$entry"

            APP_DATA=$(curl -sf --max-time 10 \
                -H "$AUTH" \
                "$API_URL/api/applications/$app_id" 2>/dev/null) || continue

            HEALTH_URL=$(echo "$APP_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('health_url') or 'none')" 2>/dev/null)
            CANDIDATES=$(echo "$APP_DATA" | python3 -c "
import sys, json
data = json.load(sys.stdin)
candidates = data.get('health_candidates', [])
valid = [c for c in candidates if c.get('score', 0) > 0]
print(f'{len(valid)} endpoints found')
for c in sorted(valid, key=lambda x: x.get('score',0), reverse=True)[:5]:
    path = c['url'].split('/', 3)[-1] if '/' in c['url'][8:] else '/'
    sel = ' ← active' if c.get('is_selected') else ''
    print(f\"    {c.get('score',0):>3}  /{path}  {c.get('http_status','')} {c.get('response_time_ms','')}ms{sel}\")
" 2>/dev/null)

            if [[ "$HEALTH_URL" != "none" ]]; then
                printf "  ${GREEN}✓ %-30s${NC} health: %s\n" "$app_name" "$HEALTH_URL"
            else
                printf "  ${YELLOW}⚠ %-30s${NC} no health endpoint found\n" "$app_name"
            fi
            echo "$CANDIDATES" | while read -r line; do
                [[ -n "$line" ]] && printf "    ${DIM}%s${NC}\n" "$line"
            done
        done
    fi

    printf "\n${BOLD}── Summary ──${NC}\n\n"
    printf "  Rediscovered: ${GREEN}%d${NC} apps\n\n" "${#REDISCOVERED_IDS[@]}"
    exit 0
fi

# ── 3. Register apps ─────────────────────────────────────────────────────────
printf "${CYAN}[3/4]${NC} Registering applications...\n\n"

CREATED_IDS=()
SKIPPED=0
FAILED=0

for entry in "${APPS[@]}"; do
    IFS='|' read -r name url <<< "$entry"
    url_clean=$(echo "$url" | sed 's:/*$::')
    url_lower=$(echo "$url_clean" | tr '[:upper:]' '[:lower:]')

    # Skip if already exists
    if echo "$EXISTING_URLS" | grep -qF "$url_lower"; then
        printf "  ${DIM}⊘ %-30s already registered${NC}\n" "$name"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    RESPONSE=$(curl -sf --max-time 15 \
        -X POST "$API_URL/api/applications" \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d "{\"display_name\": \"$name\", \"base_url\": \"$url_clean\"}" 2>&1) || {
        printf "  ${RED}✗ %-30s failed${NC}\n" "$name"
        printf "    ${DIM}%s${NC}\n" "$RESPONSE"
        FAILED=$((FAILED + 1))
        continue
    }

    APP_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null) || {
        printf "  ${RED}✗ %-30s could not parse response${NC}\n" "$name"
        FAILED=$((FAILED + 1))
        continue
    }

    CREATED_IDS+=("$APP_ID|$name")
    printf "  ${GREEN}✓ %-30s${NC} registered (id: ${DIM}%s${NC})\n" "$name" "$APP_ID"
done

printf "\n"

# ── 4. Wait for discovery to complete ─────────────────────────────────────────
if [[ ${#CREATED_IDS[@]} -gt 0 ]]; then
    printf "${CYAN}[4/4]${NC} Waiting for health endpoint discovery...\n"
    printf "  ${DIM}Discovery crawls each app, checks for API specs, then probes endpoints.${NC}\n"
    printf "  ${DIM}Waiting 15 seconds for discovery to complete...${NC}\n\n"
    sleep 15

    for entry in "${CREATED_IDS[@]}"; do
        IFS='|' read -r app_id app_name <<< "$entry"

        APP_DATA=$(curl -sf --max-time 10 \
            -H "$AUTH" \
            "$API_URL/api/applications/$app_id" 2>/dev/null) || continue

        HEALTH_URL=$(echo "$APP_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('health_url') or 'none')" 2>/dev/null)
        CANDIDATES=$(echo "$APP_DATA" | python3 -c "
import sys, json
data = json.load(sys.stdin)
candidates = data.get('health_candidates', [])
valid = [c for c in candidates if c.get('score', 0) > 0]
print(f'{len(valid)} endpoints found')
for c in sorted(valid, key=lambda x: x.get('score',0), reverse=True)[:5]:
    path = c['url'].split('/', 3)[-1] if '/' in c['url'][8:] else '/'
    sel = ' ← active' if c.get('is_selected') else ''
    print(f\"    {c.get('score',0):>3}  /{path}  {c.get('http_status','')} {c.get('response_time_ms','')}ms{sel}\")
" 2>/dev/null)

        if [[ "$HEALTH_URL" != "none" ]]; then
            printf "  ${GREEN}✓ %-30s${NC} health: %s\n" "$app_name" "$HEALTH_URL"
        else
            printf "  ${YELLOW}⚠ %-30s${NC} no health endpoint found\n" "$app_name"
        fi
        echo "$CANDIDATES" | while read -r line; do
            [[ -n "$line" ]] && printf "    ${DIM}%s${NC}\n" "$line"
        done
    done
else
    printf "${CYAN}[4/4]${NC} No new apps to discover — skipping\n"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
printf "\n${BOLD}── Summary ──${NC}\n\n"
printf "  Created:  ${GREEN}%d${NC}\n" "${#CREATED_IDS[@]}"
printf "  Skipped:  ${DIM}%d${NC} (already existed)\n" "$SKIPPED"
[[ $FAILED -gt 0 ]] && printf "  Failed:   ${RED}%d${NC}\n" "$FAILED"
printf "  Total:    ${BOLD}%d${NC} apps in seed list\n\n" "${#APPS[@]}"
