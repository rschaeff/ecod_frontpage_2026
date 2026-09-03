#!/bin/bash
# Deploy ECOD Next.js app to production directory
# Usage: ./scripts/deploy.sh [--restart]
#
# Deploys the standalone build from the dev directory to the
# production deployment directory.
#
# Two instances are served from this one source tree, so the target is
# overridable. Defaults are the /ecod2 instance, for backward compatibility:
#
#   ./scripts/deploy.sh --restart                                  # /ecod2, 3002
#   PROD_DIR=/data/ECOD/html/ecod_app PROD_PORT=3004 \
#     ./scripts/deploy.sh --restart                                # /ecod,  3004
#
# BASE_PATH lives in each target's .env.production, which is preserved across
# deploys, so the port is the only per-instance value this script has to patch.

set -e

DEV_DIR="/home/rschaeff/dev/ecod_frontpage_2026"
PROD_DIR="${PROD_DIR:-/data/ECOD/html/ecod2_app}"
PROD_PORT="${PROD_PORT:-3002}"

# The standalone build nests by relative path from workspace root
STANDALONE_APP="$DEV_DIR/.next/standalone/dev/ecod_frontpage_2026"

# Check that a standalone build exists
if [ ! -f "$STANDALONE_APP/server.js" ]; then
    echo "Error: No standalone build found at $STANDALONE_APP/server.js"
    echo "Run 'npm run build' with output: 'standalone' in next.config.ts first."
    exit 1
fi

# Check that the build was made for THIS target.
#
# next.config.ts reads basePath from process.env.BASE_PATH, and Next bakes it
# into the build -- into every emitted asset URL, not just the server config.
# So a build is specific to one instance, and deploying an /ecod2 build to the
# /ecod tree serves a site whose every route 404s. Nothing downstream catches
# it: the server starts cleanly and reports Ready.
#
# The target's own BASE_PATH is the authority, since .env.production is
# preserved across deploys and is what start.sh feeds the running server.
BUILT_BASE=$(sed -n 's/.*"basePath": *"\([^"]*\)".*/\1/p' \
    "$STANDALONE_APP/.next/required-server-files.json" | head -1)
WANT_BASE=$(sed -n 's/^BASE_PATH=//p' "$PROD_DIR/.env.production" 2>/dev/null | head -1)

if [ "$BUILT_BASE" != "$WANT_BASE" ]; then
    echo "Error: build/target mismatch."
    echo "  build was made with basePath '$BUILT_BASE'"
    echo "  $PROD_DIR expects BASE_PATH '$WANT_BASE'"
    echo ""
    echo "Rebuild for this target first:"
    echo "  BASE_PATH='$WANT_BASE' npm run build"
    exit 1
fi

echo "Deploying to $PROD_DIR (basePath '$BUILT_BASE', port $PROD_PORT)..."

# Create directory structure
mkdir -p "$PROD_DIR/logs"

# Stop the server if running
if [ -f "$PROD_DIR/start.sh" ]; then
    "$PROD_DIR/start.sh" stop 2>/dev/null || true
fi

# Deploy standalone server + minimal node_modules
echo "  Copying standalone server..."
# --delete keeps the target clean of files dropped from the build, but must not
# reap the dated .bak-* copies kept beside it as rollback points.
rsync -a --delete \
    --exclude='logs' \
    --exclude='.next-server.pid' \
    --exclude='.env.production' \
    --exclude='start.sh' \
    --exclude='*.bak-*' \
    --exclude='.next.bak-*' \
    "$STANDALONE_APP/" "$PROD_DIR/"

# Deploy the .next build output (static assets, server chunks)
echo "  Copying .next/ build output..."
rsync -a --delete "$DEV_DIR/.next/static/" "$PROD_DIR/.next/static/"

# Deploy public assets
echo "  Copying public/ assets..."
rsync -a --delete "$DEV_DIR/public/" "$PROD_DIR/public/"

# Deploy data files (Pfam clans lookup, etc.)
if [ -d "$DEV_DIR/data" ]; then
    echo "  Copying data/ files..."
    mkdir -p "$PROD_DIR/data"
    rsync -a "$DEV_DIR/data/" "$PROD_DIR/data/"
fi

# Copy env file (only if not present, preserve local edits)
if [ ! -f "$PROD_DIR/.env.production" ]; then
    cp "$DEV_DIR/.env.production" "$PROD_DIR/.env.production"
    echo "  Created .env.production (new install)"
else
    echo "  .env.production already exists (preserved)"
fi

# Copy start script
cp "$DEV_DIR/scripts/start-production.sh" "$PROD_DIR/start.sh"
chmod +x "$PROD_DIR/start.sh"

# Patch the start script for this production directory and port
sed -i "s|APP_DIR=.*|APP_DIR=\"$PROD_DIR\"|" "$PROD_DIR/start.sh"
sed -i "s|^PORT=.*|PORT=$PROD_PORT|" "$PROD_DIR/start.sh"

# Workaround: Turbopack mangles external module names in standalone builds.
# Create symlinks so the mangled names resolve to the real packages.
echo "  Fixing Turbopack module references..."
cd "$PROD_DIR/node_modules"
for mangled in $(grep -ohP 'e\.y\("[^"]+"\)' "$PROD_DIR/.next/server/chunks/"*.js 2>/dev/null | sed 's/e\.y("//;s/")//' | sort -u); do
    # Extract base package name (strip the hash suffix)
    base=$(echo "$mangled" | sed 's/-[0-9a-f]\{16\}$//')
    if [ -d "$base" ] && [ ! -e "$mangled" ]; then
        ln -sf "$base" "$mangled"
        echo "    Linked $mangled -> $base"
    fi
done
cd "$DEV_DIR"

echo ""
echo "Deploy complete."
echo ""
echo "To start/restart the production server:"
echo "  $PROD_DIR/start.sh restart"

# Auto-restart if --restart flag is passed
if [ "$1" = "--restart" ]; then
    echo ""
    "$PROD_DIR/start.sh" start
fi
