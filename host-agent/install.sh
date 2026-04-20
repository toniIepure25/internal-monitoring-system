#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_SCRIPT="/usr/local/bin/monitor-agent.py"
PLIST_SRC="$SCRIPT_DIR/com.computacenter.monitor-agent.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.computacenter.monitor-agent.plist"
CONFIG_DIR="/etc/monitor-agent"
CONFIG_FILE="$CONFIG_DIR/config.env"

echo "=== Monitor Agent Installer ==="
echo ""

# Prompt for configuration if not already set
if [ -z "$MONITOR_SERVER_URL" ]; then
    read -p "Monitoring server URL (e.g. http://10.0.1.100:8000): " MONITOR_SERVER_URL
fi

if [ -z "$MONITOR_API_KEY" ]; then
    read -p "Host API key (from the monitoring platform): " MONITOR_API_KEY
fi

MONITOR_INTERVAL="${MONITOR_INTERVAL:-30}"

echo ""
echo "Installing agent script..."
sudo cp "$SCRIPT_DIR/agent.py" "$AGENT_SCRIPT"
sudo chmod +x "$AGENT_SCRIPT"

echo "Creating config directory..."
sudo mkdir -p "$CONFIG_DIR"
sudo tee "$CONFIG_FILE" > /dev/null <<EOF
MONITOR_SERVER_URL=$MONITOR_SERVER_URL
MONITOR_API_KEY=$MONITOR_API_KEY
MONITOR_INTERVAL=$MONITOR_INTERVAL
EOF
sudo chmod 600 "$CONFIG_FILE"

echo "Installing launchd plist..."
mkdir -p "$HOME/Library/LaunchAgents"

# Generate plist with actual values
cat > "$PLIST_DST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.computacenter.monitor-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$AGENT_SCRIPT</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>MONITOR_SERVER_URL</key>
        <string>$MONITOR_SERVER_URL</string>
        <key>MONITOR_API_KEY</key>
        <string>$MONITOR_API_KEY</string>
        <key>MONITOR_INTERVAL</key>
        <string>$MONITOR_INTERVAL</string>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/monitor-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/monitor-agent.err</string>
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
EOF

echo "Loading agent..."
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo ""
echo "=== Installation complete ==="
echo "Agent is now running and will start on boot."
echo "Logs:   /tmp/monitor-agent.log"
echo "Errors: /tmp/monitor-agent.err"
echo ""
echo "To check status:  launchctl list | grep monitor-agent"
echo "To stop:          launchctl unload $PLIST_DST"
echo "To uninstall:     launchctl unload $PLIST_DST && rm $PLIST_DST && sudo rm $AGENT_SCRIPT"
