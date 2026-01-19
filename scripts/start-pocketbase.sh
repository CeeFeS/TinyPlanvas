#!/bin/bash

# TinyPlanvas - PocketBase Startup Script
# ========================================
# This script starts the PocketBase container and shows the admin URL.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Default port (can be overridden with POCKETBASE_PORT env var)
PORT="${POCKETBASE_PORT:-8090}"

echo "🚀 Starting TinyPlanvas PocketBase on port $PORT..."
echo ""

# Build and start the container
POCKETBASE_PORT=$PORT docker compose up -d --build pocketbase

# Wait for PocketBase to be ready
echo "⏳ Waiting for PocketBase to be ready..."
sleep 3

# Check if container is running (check for Up status)
if docker compose ps pocketbase 2>/dev/null | grep -qE "Up|running"; then
    echo ""
    echo "✅ PocketBase is running!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 PocketBase Admin UI:  http://127.0.0.1:$PORT/_/"
    echo "🔌 API Endpoint:         http://127.0.0.1:$PORT/api/"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📝 IMPORTANT: On first start:"
    echo "   1. Open http://127.0.0.1:$PORT/_/"
    echo "   2. Create an admin account"
    echo "   3. Collections will be created automatically!"
    echo ""
    echo "🔧 Make sure NEXT_PUBLIC_POCKETBASE_URL"
    echo "   is set to http://127.0.0.1:$PORT!"
    echo ""
    echo "🛑 To stop: npm run pocketbase:stop"
    echo ""
else
    echo "❌ Error: PocketBase container failed to start"
    echo ""
    echo "Logs:"
    docker compose logs pocketbase
    exit 1
fi
