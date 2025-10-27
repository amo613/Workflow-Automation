# Docker Setup for Neon Database

This guide explains how to run the application using Docker with Neon Local for development and Neon Cloud for production.

## 📋 Prerequisites

- [Docker](https://www.docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed
- A Neon Cloud account: [Sign up here](https://console.neon.tech/)

## 🚀 Quick Start

### Development (Neon Local)

1. **Get your Neon credentials:**
   - Sign in to [Neon Console](https://console.neon.tech/)
   - Go to your project → Settings
   - Copy your **NEON_API_KEY** and **NEON_PROJECT_ID**

2. **Configure environment:**
   ```bash
   # Edit .env.development
   nano .env.development
   
   # Add your NEON_API_KEY and NEON_PROJECT_ID
   ```

3. **Start the development environment:**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

4. **Access your application:**
   - App: http://localhost:3001
   - Health check: http://localhost:3001/health
   - Database: Available at `localhost:5432`

### Production (Neon Cloud)

1. **Get your Neon Cloud database URL:**
   - Sign in to [Neon Console](https://console.neon.tech/)
   - Go to your project → Connection Details
   - Copy your connection string

2. **Configure environment:**
   ```bash
   # Edit .env.production
   nano .env.production
   
   # Add your DATABASE_URL
   ```

3. **Start the production environment:**
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

## 🔄 Database Migrations

### Development

```bash
# Run migrations inside container
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate

# Or run locally (connects to Neon Local)
DATABASE_URL=postgres://neon@localhost:5432/neondb npm run db:migrate
```

### Production

```bash
# Set DATABASE_URL to production URL, then migrate
DATABASE_URL=your-production-url npm run db:migrate
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

