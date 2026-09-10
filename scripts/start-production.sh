#!/bin/bash
# Start ECOD Next.js app in production mode on sangala
# Usage: ./scripts/start-production.sh [start|stop|restart|status|health]
#
# deploy.sh installs this as <target>/start.sh and rewrites APP_DIR for the
# target. It must NOT rewrite PORT: the port comes from the target's own
# .env.production, which is what server.js binds.

APP_DIR="/home/rschaeff/dev/ecod_frontpage_2026"
PID_FILE="$APP_DIR/.next-server.pid"
LOG_FILE="$APP_DIR/logs/production.log"

# Fix libstdc++ on sangala
export LD_LIBRARY_PATH=/usr/lib64${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}
export PATH=/home/rschaeff/.local/node/bin:$PATH
export NODE_ENV=production

# Load .env.production (Next.js may not find it due to workspace root detection)
ENV_FILE="$APP_DIR/.env.production"
if [ -f "$ENV_FILE" ]; then
    while IFS= read -r line; do
        line="${line%$'\r'}"
        # Skip comments and empty lines
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        export "${line#export }"
    done < "$ENV_FILE"
fi

# server.js binds $PORT from .env.production -- never hardcode it here, or the
# two drift and you start believing a port the server never bound. (2026-09-10)
PORT="${PORT:-3000}"
HEALTH_PATH="${BASE_PATH:-}/"

mkdir -p "$APP_DIR/logs"

# Who is listening on $PORT? Echoes a PID when it is one of ours, else nothing.
port_owner_pid() {
    ss -ltnpH "sport = :$PORT" 2>/dev/null |
        sed -n 's/.*pid=\([0-9]\{1,\}\).*/\1/p' | head -1
}

port_in_use() {
    [ -n "$(ss -ltnH "sport = :$PORT" 2>/dev/null)" ]
}

# A live socket is not a live server: the Sep 2026 outage was a next-server
# spinning at 100% CPU that still held :3004 but answered nothing. Ask for a
# real response line, not just a bound port or a surviving PID.
http_probe() {
    timeout "${1:-10}" bash -c "
        exec 3<>/dev/tcp/127.0.0.1/$PORT || exit 1
        printf 'GET %s HTTP/1.0\r\nHost: localhost\r\n\r\n' '$HEALTH_PATH' >&3
        head -1 <&3
    " 2>/dev/null
}

running_pid() {
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        cat "$PID_FILE"
    fi
}

start() {
    PID=$(running_pid)
    if [ -n "$PID" ]; then
        echo "Server already running (PID $PID)"
        return 1
    fi

    # The PID file is not authoritative -- it goes missing, and a stranded
    # server keeps the port. Check the port before assuming we can have it.
    if port_in_use; then
        OWNER=$(port_owner_pid)
        echo "Port $PORT is already bound${OWNER:+ by PID $OWNER}, refusing to start." >&2
        if [ -n "$OWNER" ]; then
            ps -o pid,etime,%cpu,cmd -p "$OWNER" >&2
            echo "If that server is wedged, stop it first: kill $OWNER (then kill -9)." >&2
        else
            echo "Owner belongs to another user; ask them to release port $PORT." >&2
        fi
        return 1
    fi

    echo "Starting ECOD production server on port $PORT..."
    cd "$APP_DIR" || return 1
    HOSTNAME=0.0.0.0 nohup node server.js > "$LOG_FILE" 2>&1 &
    NEW_PID=$!
    echo "$NEW_PID" > "$PID_FILE"

    # Wait for an actual HTTP reply, not merely a surviving process.
    for _ in $(seq 1 30); do
        if ! kill -0 "$NEW_PID" 2>/dev/null; then
            echo "Failed to start server -- process exited. Check $LOG_FILE" >&2
            tail -5 "$LOG_FILE" >&2
            rm -f "$PID_FILE"
            return 1
        fi
        STATUS=$(http_probe 5)
        if [ -n "$STATUS" ]; then
            echo "Server started (PID $NEW_PID), port $PORT -- $STATUS"
            echo "Logs: $LOG_FILE"
            return 0
        fi
        sleep 1
    done

    echo "Server (PID $NEW_PID) is up but did not answer $HEALTH_PATH in time." >&2
    echo "It may still be warming up; check $LOG_FILE and ./start.sh health." >&2
    return 1
}

stop() {
    PID=$(running_pid)
    if [ -z "$PID" ]; then
        # No usable PID file -- fall back to whoever holds the port. The old
        # "pkill -f 'next start.*PORT'" never matched: the standalone server
        # runs as `node server.js` and retitles itself `next-server (v...)`.
        PID=$(port_owner_pid)
        [ -n "$PID" ] && echo "No valid PID file; using port $PORT owner (PID $PID)"
    fi

    if [ -z "$PID" ]; then
        echo "Server not running"
        rm -f "$PID_FILE"
        return 0
    fi

    echo "Stopping server (PID $PID)..."
    kill "$PID" 2>/dev/null
    for _ in $(seq 1 10); do
        kill -0 "$PID" 2>/dev/null || break
        sleep 1
    done
    if kill -0 "$PID" 2>/dev/null; then
        # A spinning event loop never runs Next's SIGTERM handler.
        echo "Did not exit on SIGTERM, sending SIGKILL"
        kill -9 "$PID" 2>/dev/null
    fi
    echo "Server stopped"
    rm -f "$PID_FILE"
}

status() {
    PID=$(running_pid)
    OWNER=$(port_owner_pid)

    if [ -z "$PID" ] && [ -z "$OWNER" ] && ! port_in_use; then
        echo "Server not running"
        return 1
    fi

    if [ -z "$PID" ] && [ -n "$OWNER" ]; then
        echo "WARNING: no valid PID file, but PID $OWNER holds port $PORT"
        PID=$OWNER
    fi

    STATUS=$(http_probe 10)
    if [ -n "$STATUS" ]; then
        echo "Server running (PID $PID) on port $PORT -- $STATUS"
    else
        echo "Server process ${PID:-?} holds port $PORT but is NOT responding."
        [ -n "$PID" ] && ps -o pid,etime,%cpu,rss,cmd -p "$PID"
        echo "Likely wedged. Recover with: $0 restart"
        return 1
    fi
}

health() {
    STATUS=$(http_probe 15)
    if [ -n "$STATUS" ]; then
        echo "OK  $HEALTH_PATH -- $STATUS"
    else
        echo "FAIL  no response from port $PORT within 15s" >&2
        return 1
    fi
}

case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    restart) stop; start ;;
    status)  status ;;
    health)  health ;;
    *)       echo "Usage: $0 {start|stop|restart|status|health}" ;;
esac
