#!/bin/bash
# Playwright Browser Client - talks to persistent server via stdin/stdout
# Usage: client.sh <command> [args...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$SCRIPT_DIR/browser-server.js"
PID_FILE="/tmp/playwright-server.pid"
LOG_FILE="/tmp/playwright-server.log"

usage() {
    echo "Usage: $0 <command> [args...]"
    echo ""
    echo "Commands:"
    echo "  open <url>              - Open page, start persistent session"
    echo "  title                   - Get page title"
    echo "  url                     - Get current URL"
    echo "  content                 - Get page text content"
    echo "  html                    - Get full HTML"
    echo "  screenshot [path]       - Take screenshot"
    echo "  click <selector>        - Click element"
    echo "  type <selector> <text>  - Type text"
    echo "  eval <js>              - Execute JavaScript"
    echo "  exists <selector>       - Check element exists"
    echo "  links                   - List all links"
    echo "  wait <selector>        - Wait for element"
    echo "  close                   - End session"
    echo ""
    echo "Workflow example:"
    echo '  $0 open "https://example.com"'
    echo '  $0 eval "document.querySelector(\".item\").textContent"'
    echo '  $0 click ".submit-btn"'
    echo '  $0 wait ".success"'
    echo '  $0 eval "document.body.textContent"'
    echo '  $0 close'
    exit 1
}

if [ $# -lt 1 ]; then
    usage
fi

is_running() {
    [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start_server() {
    echo "[client] Starting server..." >&2
    node "$SERVER" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
}

CMD="$1"
shift

# For open command, use first arg as URL
if [ "$CMD" = "open" ]; then
    ARGS="[\"$1\"]"
else
    # JSON encode args
    JSON_ARGS=""
    for arg in "$@"; do
        # Escape special chars
        arg=$(echo "$arg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\n/\\n/g')
        if [ -z "$JSON_ARGS" ]; then
            JSON_ARGS="\"$arg\""
        else
            JSON_ARGS="$JSON_ARGS,\"$arg\""
        fi
    done
    ARGS="[$JSON_ARGS]"
fi

# Start server if needed
if ! is_running; then
    start_server
fi

PID=$(cat "$PID_FILE")

# Send command
echo "{\"command\":\"$CMD\",\"args\":$ARGS}" | kill -USR1 "$PID" 2>/dev/null

# Wait for response (poll for file)
RESP_FILE="/tmp/playwright-resp-$PID.txt"
rm -f "$RESP_FILE" 2>/dev/null

# Server writes to response file
timeout 5 bash -c "
    while ! [ -f '$RESP_FILE' ]; do sleep 0.1; done
" 2>/dev/null

if [ -f "$RESP_FILE" ]; then
    cat "$RESP_FILE"
    rm -f "$RESP_FILE"
else
    echo '{"ok":false,"error":"timeout"}'
fi