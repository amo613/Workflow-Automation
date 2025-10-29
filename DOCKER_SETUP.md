# Docker Setup for Neon Database

This guide explains how to run the application using Docker with Neon Local for development and Neon Cloud for production. The project includes automated scripts that handle the entire setup process for you.

## 📋 Prerequisites

- [Docker](https://www.docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed
- A Neon Cloud account: [Sign up here](https://console.neon.tech/)
- Node.js and npm (for running scripts)

## 🚀 Quick Start

### Development (Neon Local)

**Option A: Using npm script (Recommended)**

1. **Get your Neon credentials:**
   - Sign in to [Neon Console](https://console.neon.tech/)
   - Go to your project → Settings
   - Copy your **NEON_API_KEY** and **NEON_PROJECT_ID**

2. **Configure environment:**

   ```bash
   # Copy template and edit
   cp .env.example .env.development
   nano .env.development

   # Add your NEON_API_KEY and NEON_PROJECT_ID
   ```

3. **Start the development environment:**

   ```bash
   npm run dev:docker
   ```

   This runs the `scripts/dev.sh` script which:
   - Checks if `.env.development` exists
   - Verifies Docker is running
   - Creates `.neon_local/` directory
   - Adds `.neon_local/` to `.gitignore`
   - Runs database migrations
   - Starts Docker Compose with Neon Local

**Option B: Manual Docker Compose**

```bash
docker-compose -f docker-compose.dev.yml up --build
```

4. **Access your application:**
   - App: http://localhost:3001
   - Health check: http://localhost:3001/health
   - Database: Available at `localhost:5432`

### Production (Neon Cloud)

**Option A: Using npm script (Recommended)**

1. **Get your Neon Cloud database URL:**
   - Sign in to [Neon Console](https://console.neon.tech/)
   - Go to your project → Connection Details
   - Copy your connection string

2. **Configure environment:**

   ```bash
   # Create production environment file
   cp .env.example .env.production
   nano .env.production

   # Add your DATABASE_URL and production secrets
   ```

3. **Start the production environment:**

   ```bash
   npm run prod:docker
   ```

   This runs the `scripts/prod.sh` script which:
   - Checks if `.env.production` exists
   - Verifies Docker is running
   - Starts production containers in detached mode
   - Runs database migrations
   - Provides helpful commands for monitoring

**Option B: Manual Docker Compose**

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

## 📁 Project Structure

```
.
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.dev.yml     # Development with Neon Local
├── docker-compose.prod.yml    # Production with Neon Cloud
├── .dockerignore              # Files excluded from Docker build
├── .env.development           # Development environment variables
├── .env.production            # Production environment variables
├── scripts/                   # Automated setup scripts
│   ├── dev.sh                 # Development startup script
│   └── prod.sh                # Production startup script
└── DOCKER_SETUP.md           # This file
```

## 🎯 What Each File Does

### Dockerfile

- **Base stage**: Installs production dependencies
- **Development stage**: Installs all dependencies + dev tools for hot reload
- **Production stage**: Runs production server
- Uses port **3001** internally
- Includes health checks

### docker-compose.dev.yml

- **neon-local**: Runs Neon Local proxy for local database
- **app**: Your application with hot-reload enabled
- Loads `.env.development` for configuration
- Automatically connects to Neon Local database

### docker-compose.prod.yml

- **app**: Runs production build
- Loads `.env.production` for configuration
- Connects to Neon Cloud database
- Includes resource limits (memory, CPU)

### scripts/dev.sh

The development script (`npm run dev:docker`) performs these automated steps:

1. **Environment Check**: Verifies `.env.development` exists
2. **Docker Check**: Ensures Docker is running
3. **Directory Setup**: Creates `.neon_local/` for Neon Local data
4. **Git Configuration**: Adds `.neon_local/` to `.gitignore`
5. **Database Migration**: Runs `npm run db:migrate`
6. **Database Health Check**: Waits for Neon Local to be ready
7. **Container Startup**: Starts `docker-compose.dev.yml` with build

**What happens during execution:**

- Neon Local creates an ephemeral database branch
- Application runs with hot-reload enabled
- Source code is mounted for instant changes
- Database migrations are applied automatically

### scripts/prod.sh

The production script (`npm run prod:docker`) performs these automated steps:

1. **Environment Check**: Verifies `.env.production` exists
2. **Docker Check**: Ensures Docker is running
3. **Container Startup**: Starts `docker-compose.prod.yml` in detached mode
4. **Health Check**: Waits for services to be ready
5. **Database Migration**: Runs `npm run db:migrate`
6. **Status Information**: Provides monitoring commands

**What happens during execution:**

- Uses Neon Cloud Database (no local proxy)
- Runs in optimized production mode
- Containers run in background (`-d` flag)
- Resource limits are applied
- Production logging is configured

## 🔧 Environment Variables

### .env.development

```env
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
DATABASE_URL=
JWT_SECRET=dev-secret
JWT_EXPIRES_IN=1d
ARCJET_KEY=your-key-here
NEON_API_KEY=your-api-key        # Required for Neon Local
NEON_PROJECT_ID=your-project-id  # Required for Neon Local
```

### .env.production

```env
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgres://...      # Your Neon Cloud URL
JWT_SECRET=production-secret     # Use strong random secret
JWT_EXPIRES_IN=1d
ARCJET_KEY=your-production-key
```

## 📖 Common Commands

### Development

**Using npm scripts (Recommended):**

```bash
# Start development environment
npm run dev:docker

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

**Manual Docker Compose:**

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down

# Rebuild containers
docker-compose -f docker-compose.dev.yml up --build

# Access app container
docker exec -it acquisitions-app-dev sh
```

### Production

**Using npm scripts (Recommended):**

```bash
# Start production environment
npm run prod:docker

# Stop production environment
docker-compose -f docker-compose.prod.yml down
```

**Manual Docker Compose:**

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Stop services
docker-compose -f docker-compose.prod.yml down

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Script Output Examples

**Development Script (`npm run dev:docker`):**

```
Starting Acquisition App in Development Mode
================================================
📦 Building and starting development containers...
   - Neon Local proxy will create an ephemeral database branch
   - Application will run with hot reload enabled

📜 Applying latest schema with Drizzle...
⏳ Waiting for the database to be ready...

🎉 Development environment started!
   Application: http://localhost:3001
   Database: postgres://neon:npg@localhost:5432/neondb

To stop the environment, press Ctrl+C or run: docker compose down
```

**Production Script (`npm run prod:docker`):**

```
🚀 Starting Acquisition App in Production Mode
===============================================
📦 Building and starting production container...
   - Using Neon Cloud Database (no local proxy)
   - Running in optimized production mode

⏳ Waiting for Neon Local to be ready...
📜 Applying latest schema with Drizzle...

🎉 Production environment started!
   Application: http://localhost:3000
   Logs: docker logs acquisition-app-prod

Useful commands:
   View logs: docker logs -f acquisition-app-prod
   Stop app: docker compose -f docker-compose.prod.yml down
```

## 🔄 Database Migrations

### Development

**Automatic (via scripts):**

- Migrations run automatically when using `npm run dev:docker`
- The script executes `npm run db:migrate` before starting containers

**Manual:**

```bash
# Run migrations inside container
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate

# Or run locally (connects to Neon Local)
DATABASE_URL=postgres://neon@localhost:5432/neondb npm run db:migrate
```

### Production

**Automatic (via scripts):**

- Migrations run automatically when using `npm run prod:docker`
- The script executes `npm run db:migrate` after starting containers

**Manual:**

```bash
# Set DATABASE_URL to production URL, then migrate
DATABASE_URL=your-production-url npm run db:migrate
```

### Migration Commands

```bash
# Generate new migration (after modifying models)
npm run db:generate

# Run migrations
npm run db:migrate

# Open Drizzle Studio (database GUI)
npm run db:studio
```

## 🐛 Troubleshooting

### Port Already in Use

If port 3001 or 5432 is already in use:

```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Kill process on port 5432
lsof -ti:5432 | xargs kill -9
```

### Database Connection Issues

```bash
# Check if Neon Local is running
docker-compose -f docker-compose.dev.yml ps neon-local

# View Neon Local logs
docker-compose -f docker-compose.dev.yml logs neon-local

# Restart services
docker-compose -f docker-compose.dev.yml restart
```

### Reset Everything

```bash
# Stop and remove all containers and volumes
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.prod.yml down -v

# Start fresh
docker-compose -f docker-compose.dev.yml up --build
```

## 📚 Additional Resources

- [Neon Local Documentation](https://neon.com/docs/local/neon-local)
- [Neon Cloud Documentation](https://neon.com/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## ✨ Tips

1. **Development**: Source code is mounted, so changes are reflected immediately
2. **Production**: Use environment variables, never hardcode secrets
3. **Neon Local**: Automatically creates database branches for git workflow
4. **Health Checks**: Both dev and prod include health check endpoints
5. **Scripts**: Use `npm run dev:docker` and `npm run prod:docker` for automated setup
6. **Logs**: Check container logs if something goes wrong
7. **Migrations**: Scripts handle migrations automatically, but you can run them manually
8. **Environment**: Always copy from `.env.example` to create your environment files
9. **Docker**: Make sure Docker Desktop is running before using scripts
10. **Ports**: Development uses port 3001, production uses port 3000
