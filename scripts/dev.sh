#!/bin/bash


echo "Starting Acquisition App in Development Mode"
echo "================================================"

# Check if .env.development exists
if [ ! -f .env.development ]; then
    echo "❌ Error: .env.development file not found!"
    echo "   Please copy .env.development from the template and update with your Neon credentials."
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "   Please start Docker Desktop and try again."
    exit 1
fi

# Create .neon_local directory if it doesn't exist
mkdir -p .neon_local

# Add .neon_local to .gitignore if not already present
if ! grep -q ".neon_local/" .gitignore 2>/dev/null; then
    echo ".neon_local/" >> .gitignore
    echo "✅ Added .neon_local/ to .gitignore"
fi

echo "📦 Building and starting development containers..."
echo "   - Neon Local proxy will create an ephemeral database branch"
echo "   - Application will run with hot reload enabled"
echo ""

# Start development environment in background
docker-compose -f docker-compose.dev.yml up -d --build

# Wait for the database to be ready
echo "⏳ Waiting for the database to be ready..."
docker-compose -f docker-compose.dev.yml exec -T neon-local psql -U neon -d neondb -c 'SELECT 1' >/dev/null 2>&1 || sleep 5

# Run migrations with Drizzle inside the container
echo "📜 Applying latest schema with Drizzle..."
docker-compose -f docker-compose.dev.yml exec -T app npm run db:migrate

# Show logs
docker-compose -f docker-compose.dev.yml up

echo ""
echo "🎉 Development environment started!"
echo "   Application: http://localhost:3001"  # RICHTIG
echo "   Database: postgres://neon:npg@localhost:5432/neondb"
echo ""
echo "To stop the environment, press Ctrl+C or run: docker compose down"