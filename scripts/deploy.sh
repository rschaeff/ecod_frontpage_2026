#!/bin/bash
# Deploy ECOD Next.js app to production directory
# Usage: ./scripts/deploy.sh [--restart]
#
# Deploys the standalone build from the dev directory to the
# production deployment directory.

set -e

DEV_DIR="/home/rschaeff/dev/ecod_frontpage_2026"
PROD_DIR="/data/ECOD/html/ecod2_app"

# The standalone build nests by relative path from workspace root
STANDALONE_APP="$DEV_DIR/.next/standalone/dev/ecod_frontpage_2026"

# Check that a standalone build exists
if [ ! -f "$STANDALONE_APP/server.js" ]; then
    echo "Error: No standalone build found at $STANDALONE_APP/server.js"
    echo "Run 'npm run build' with output: 'standalone' in next.config.ts first."
    exit 1
fi

echo "Deploying to $PROD_DIR..."

# Create directory structure
mkdir -p "$PROD_DIR/logs"

# Stop the server if running
if [ -f "$PROD_DIR/start.sh" ]; then
    "$PROD_DIR/start.sh" stop 2>/dev/null || true
fi

# Deploy standalone server + minimal node_modules
echo "  Copying standalone server..."
rsync -a --delete \
    --exclude='logs' \
    --exclude='.next-server.pid' \
    --exclude='.env.production' \
    --exclude='start.sh' \
    "$STANDALONE_APP/" "$PROD_DIR/"

# Deploy the .next build output (static assets, server chunks)
echo "  Copying .next/ build output..."
rsync -a --delete "$DEV_DIR/.next/static/" "$PROD_DIR/.next/static/"

# Deploy public assets
echo "  Copying public/ assets..."
rsync -a --delete "$DEV_DIR/public/" "$PROD_DIR/public/"

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

# Patch the start script for production directory
sed -i "s|APP_DIR=.*|APP_DIR=\"$PROD_DIR\"|" "$PROD_DIR/start.sh"

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
