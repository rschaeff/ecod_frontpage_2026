#!/bin/bash
# Start ECOD Next.js app in production mode on sangala
# Usage: ./scripts/start-production.sh [start|stop|restart|status]

APP_DIR="/home/rschaeff/dev/ecod_frontpage_2026"
PID_FILE="$APP_DIR/.next-server.pid"
LOG_FILE="$APP_DIR/logs/production.log"
PORT=3002

# Fix libstdc++ on sangala
export LD_LIBRARY_PATH=/usr/lib64${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
export PATH=/home/rschaeff/.local/node/bin:$PATH
export NODE_ENV=production

mkdir -p "$APP_DIR/logs"

start() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Server already running (PID $(cat "$PID_FILE"))"
        return 1
    fi

    echo "Starting ECOD production server on port $PORT..."
    cd "$APP_DIR"
    nohup node .next/standalone/server.js > "$LOG_FILE" 2>&1 &
    # Fallback: use npm start if standalone not available
    if [ $? -ne 0 ] || ! kill -0 $! 2>/dev/null; then
        nohup npm start -- -p "$PORT" > "$LOG_FILE" 2>&1 &
    fi
    echo $! > "$PID_FILE"
    sleep 2

    if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Server started (PID $(cat "$PID_FILE")), port $PORT"
        echo "Logs: $LOG_FILE"
    else
        echo "Failed to start server. Check $LOG_FILE"
        rm -f "$PID_FILE"
        return 1
    fi
}

stop() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Stopping server (PID $PID)..."
            kill "$PID"
            sleep 2
            # Force kill if still running
            if kill -0 "$PID" 2>/dev/null; then
                kill -9 "$PID"
            fi
            echo "Server stopped"
        else
            echo "Server not running (stale PID file)"
        fi
        rm -f "$PID_FILE"
    else
        echo "No PID file found"
        # Try to find and kill anyway
        pkill -f "next start.*$PORT" 2>/dev/null
    fi
}

status() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Server running (PID $(cat "$PID_FILE")) on port $PORT"
    else
        echo "Server not running"
    fi
}

case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; sleep 1; start ;;
    status)  status ;;
    *)       echo "Usage: $0 {start|stop|restart|status}" ;;
esac
