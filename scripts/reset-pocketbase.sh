#!/bin/bash

# TinyPlanvas - PocketBase Reset Script
# =====================================
# This script deletes all PocketBase data and restarts fresh.
# WARNING: All data will be lost!

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "⚠️  WARNING: This script will delete ALL PocketBase data!"
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🛑 Stopping PocketBase container..."
docker compose down 2>/dev/null || true

echo ""
echo "🗑️  Deleting PocketBase volume (all data)..."
docker volume rm tinyplanvas_pocketbase_data 2>/dev/null || true

echo ""
echo "🔧 Removing old Docker image..."
docker rmi tinyplanvas-pocketbase 2>/dev/null || true

echo ""
echo "🏗️  Building new Docker image with current migrations..."
docker compose build --no-cache pocketbase

echo ""
echo "🚀 Starting PocketBase..."
docker compose up -d pocketbase

echo ""
echo "⏳ Waiting for PocketBase..."
sleep 5

# Check if container is running
if docker compose ps pocketbase 2>/dev/null | grep -qE "Up|running"; then
    echo ""
    echo "✅ PocketBase has been successfully reset!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Next steps:"
    echo ""
    echo "   1. Open http://127.0.0.1:8090/_/"
    echo "   2. Create a PocketBase superuser (for Admin Dashboard)"
    echo "   3. Go to the app and create your app administrator"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📝 Check the migrations in the logs:"
    echo "   docker compose logs pocketbase"
    echo ""
else
    echo ""
    echo "❌ Error: PocketBase container could not be started"
    echo ""
    echo "Logs:"
    docker compose logs pocketbase
    exit 1
fi
