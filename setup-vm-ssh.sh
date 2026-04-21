#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Setup SSH key for the backend to access the Ubuntu VM
#
# Run this ONCE from the Mac. It:
#   1. Generates an SSH key pair (vm_ssh_key / vm_ssh_key.pub)
#   2. Installs the public key on the VM via multipass
#   3. Tests the SSH connection
#
# After this, the backend container can SSH to the VM to fetch docker logs.
# ─────────────────────────────────────────────────────────────────────────────

VM_NAME="${VM_NAME:-ubuntu-vm}"
KEY_FILE="./vm_ssh_key"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

printf "\n${BOLD}${CYAN}  Setup VM SSH Access${NC}\n\n"

# 1. Check multipass
if ! command -v multipass &>/dev/null; then
    printf "${RED}[FAIL]${NC} multipass not found\n"
    exit 1
fi

VM_IP=$(multipass info "$VM_NAME" --format csv 2>/dev/null | tail -1 | cut -d',' -f3) || {
    printf "${RED}[FAIL]${NC} Could not get VM info. Is %s running?\n" "$VM_NAME"
    exit 1
}
printf "  VM: ${BOLD}%s${NC} at ${BOLD}%s${NC}\n" "$VM_NAME" "$VM_IP"

# 2. Generate key pair
if [[ -f "$KEY_FILE" ]]; then
    printf "  ${DIM}SSH key already exists at %s${NC}\n" "$KEY_FILE"
else
    printf "  Generating SSH key...\n"
    ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "monitoring-system-backend" -q
    printf "${GREEN}[OK]${NC}   Key generated: %s\n" "$KEY_FILE"
fi

# 3. Install public key on VM
PUB_KEY=$(cat "${KEY_FILE}.pub")
printf "  Installing public key on VM...\n"

multipass exec "$VM_NAME" -- bash -c "
    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    grep -qF '$(cat ${KEY_FILE}.pub)' ~/.ssh/authorized_keys 2>/dev/null || echo '$PUB_KEY' >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
" || {
    printf "${RED}[FAIL]${NC} Could not install key on VM\n"
    exit 1
}
printf "${GREEN}[OK]${NC}   Public key installed\n"

# 4. Test SSH connection
printf "  Testing SSH connection...\n"
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "ubuntu@${VM_IP}" "echo 'SSH OK'" 2>/dev/null && {
    printf "${GREEN}[OK]${NC}   SSH connection works\n"
} || {
    printf "${RED}[FAIL]${NC} SSH test failed — the key may need manual installation\n"
    printf "  ${DIM}Try: ssh -i %s ubuntu@%s${NC}\n" "$KEY_FILE" "$VM_IP"
    exit 1
}

# 5. Test docker access
printf "  Testing docker access...\n"
CONTAINER_COUNT=$(ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "ubuntu@${VM_IP}" "docker ps -q | wc -l" 2>/dev/null) || CONTAINER_COUNT="?"
printf "${GREEN}[OK]${NC}   Docker accessible — %s containers running\n" "$CONTAINER_COUNT"

# 6. Update .env if needed
if [[ -f ".env" ]]; then
    if ! grep -q "^VM_SSH_HOST=" .env 2>/dev/null; then
        printf "\n# VM Container Access\nVM_SSH_HOST=%s\nVM_SSH_USER=ubuntu\nVM_SSH_PORT=22\nVM_SSH_KEY_PATH=/root/.ssh/vm_key\n" "$VM_IP" >> .env
        printf "${GREEN}[OK]${NC}   Added VM_SSH settings to .env\n"
    else
        printf "  ${DIM}VM_SSH settings already in .env${NC}\n"
    fi
fi

printf "\n${BOLD}── Done ──${NC}\n\n"
printf "  SSH key:  ${BOLD}%s${NC}\n" "$KEY_FILE"
printf "  VM IP:    ${BOLD}%s${NC}\n" "$VM_IP"
printf "  User:     ${BOLD}ubuntu${NC}\n\n"
printf "  ${CYAN}Next steps:${NC}\n"
printf "    1. Redeploy:  ${BOLD}./deploy.sh${NC}\n"
printf "    2. Bind:      ${BOLD}./bind-containers.sh${NC}\n"
printf "    3. View logs in the app detail page\n\n"
