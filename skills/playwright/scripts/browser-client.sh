#!/bin/bash
# Playwright Browser Client - interacts with persistent server
# Usage: browser-client.sh <command> [args...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$SCRIPT_DIR/browser-server.js"
PID_FILE="/tmp/playwright-browser.pid"
FIFO_IN="/tmp/playwright-in.fifo"
FIFO_OUT="/tmp/playwright-out.fifo"

usage() {
    echo "Usage: $0 <command> [args...]"
    echo ""
    echo "Session Management:"
    echo "  start               - Start persistent browser server"
    echo "  stop                - Stop server"
    echo "  status              - Check server status"
    echo ""
    echo "Browser Commands:"
    echo "  open <url>          - Open page"
    echo "  title               - Get page title"
    echo "  url                 - Get current URL"
    echo "  content             - Get page text"
    echo "  html                - Get HTML"
    echo "  screenshot [path]   - Take screenshot"
    echo "  click <selector>    - Click element"
    echo "  type <selector> <text> - Type text"
    echo "  eval <js>           - Execute JavaScript"
    echo "  exists <selector>   - Check element exists"
    echo "  links               - List all links"
    echo "  wait <selector>     - Wait for element"
    echo "  text <selector>     - Get element text"
    echo "  get-value <selector> - Get input value"
    echo ""
    echo "Example workflow:"
    echo "  $0 start"
    echo "  $0 open https://example.com"
    echo "  $0 type '#email' 'user@example.com'"
    echo "  $0 click '.submit'"
    echo "  $0 wait '.success'"
    echo "  $0 stop"
    exit 1
}

is_running() {
    [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start_server() {
    if is_running; then
        echo "[client] Server already running (PID $(cat "$PID_FILE"))" >&2
        return 0
    fi

    echo "[client] Starting browser server..." >&2
    
    # Create FIFOs
    rm -f "$FIFO_IN" "$FIFO_OUT"
    mkfifo "$FIFO_IN"
    mkfifo "$FIFO_OUT"
    
    # Start server in background
    node "$SERVER" < "$FIFO_IN" > "$FIFO_OUT" 2>&1 &
    echo $! > "$PID_FILE"
    
    # Wait for server to be ready
    sleep 2
    
    if is_running; then
        echo "[client] Server started (PID $(cat "$PID_FILE"))" >&2
        return 0
    else
        echo "[client] Server failed to start" >&2
        rm -f "$PID_FILE"
        return 1
    fi
}

stop_server() {
    if ! is_running; then
        echo "[client] Server not running" >&2
        return 0
    fi
    
    local pid=$(cat "$PID_FILE")
    echo "[client] Stopping server (PID $pid)..." >&2
    kill "$pid" 2>/dev/null
    sleep 1
    
    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null
    fi
    
    rm -f "$PID_FILE" "$FIFO_IN" "$FIFO_OUT"
    echo "[client] Server stopped" >&2
}

send_command() {
    local cmd="$1"
    shift
    
    # Build JSON args array
    local args="["
    local first=true
    for arg in "$@"; do
        if [ "$first" = true ]; then
            first=false
        else
            args="$args,"
        fi
        # Escape quotes in arg
        arg=$(echo "$arg" | sed 's/"/\\"/g')
        args="$args\"$arg\""
    done
    args="$args]"
    
    local json="{\"command\":\"$cmd\",\"args\":$args}"
    
    # Send command and read response
    echo "$json" > "$FIFO_IN" &
    local response=$(timeout 30 cat "$FIFO_OUT")
    
    if [ -z "$response" ]; then
        echo '{"ok":false,"error":"timeout"}' >&2
        return 1
    fi
    
    echo "$response"
    
    # Check if ok
    if echo "$response" | grep -q '"ok":true'; then
        return 0
    else
        return 1
    fi
}

# Main
if [ $# -eq 0 ]; then
    usage
fi

CMD="$1"
shift

case "$CMD" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    status)
        if is_running; then
            echo "[client] Server running (PID $(cat "$PID_FILE"))" >&2
        else
            echo "[client] Server not running" >&2
        fi
        ;;
    open|title|url|content|html|screenshot|click|type|eval|exists|links|wait|text|get-value|ping)
        if ! is_running; then
            echo "[client] Server not running. Start with: $0 start" >&2
            exit 1
        fi
        send_command "$CMD" "$@"
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        echo "Unknown command: $CMD" >&2
        usage
        ;;
esac