#!/bin/bash


echo "🚀 Starting Acquisition App in Production Mode"
echo "==============================================="

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production file not found!"
    echo "   Please create .env.production with your production environment variables."
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "   Please start Docker and try again."
    exit 1
fi

echo "📦 Building and starting production container..."
echo "   - Using Neon Cloud Database (no local proxy)"
echo "   - Running in optimized production mode"
echo ""

# Start production environment
# Use --scale app=3 for horizontal scaling (3 instances)
docker compose -f docker-compose.prod.yml up --build -d --scale app=3

# Wait for containers to be ready
echo "⏳ Waiting for containers to be ready..."
sleep 10

# Run migrations explicitly (like in dev.sh)
echo "📜 Generating database migrations..."
docker compose -f docker-compose.prod.yml exec -T app npm run db:generate || echo "⚠️ Migration generation skipped (may already be up to date)"

echo "📜 Applying latest schema with Drizzle..."
docker compose -f docker-compose.prod.yml exec -T app npm run db:migrate || echo "⚠️ Migration skipped (may already be applied)"

echo ""
echo "🎉 Production environment started!"
echo "   Application: http://localhost:${PORT:-3001}"
echo "   Logs: docker logs acquisitions-app-prod"
echo ""
echo "Useful commands:"
echo "   View logs: docker logs -f acquisition-app-prod"
echo "   Stop app: docker compose -f docker-compose.prod.yml down"