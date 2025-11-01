# Testing - Universal API Library

A high-performance, production-ready API collection built with Node.js, Express, Drizzle ORM, and Neon Database. This project serves as a comprehensive API library for various use cases with robust middleware, Docker support, automated testing, and CI/CD workflows.

## 🚀 Features

- **Fast & Performant**: Built with Express.js and optimized middleware
- **Secure**: Helmet, Arcjet, authentication & authorization
- **Scalable**: Dockerized with multi-stage builds
- **Modern Stack**: ES Modules, Drizzle ORM, Zod validation
- **Developer Experience**: Hot-reload, ESLint, Prettier, Jest
- **CI/CD Ready**: GitHub Actions for linting, testing, and Docker builds
- **Database**: Neon (PostgreSQL) with local development support

## 📋 Prerequisites

- **Node.js** >= 20.x
- **Docker** & Docker Compose (for containerized runs)
- **Neon Account** for database (sign up at [console.neon.tech](https://console.neon.tech/))
- **npm** or **yarn**

## 🛠️ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/amo613/Testing.git
cd Testing
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

For development, create `.env.development`:

```bash
# Copy template
cp .env.example .env.development
```

Edit `.env.development` and add your Neon credentials:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Database Configuration (Set by docker-compose.dev.yml automatically)
DATABASE_URL=

# JWT Configuration
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=1d

# Arcjet Configuration
ARCJET_KEY=your-arcjet-key-here

# Neon API Configuration
NEON_API_KEY=your-neon-api-key-here
NEON_PROJECT_ID=your-neon-project-id-here
```

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start the Application

**Option A: Local Development (without Docker)**

```bash
npm run dev
```

Server runs at: http://localhost:3001

**Option B: Docker Development (with Neon Local)**

```bash
npm run dev:docker
```

Or use the script directly:

```bash
sh ./scripts/dev.sh
```

Server runs at: http://localhost:3001

**Option C: Production Mode**

```bash
npm run prod:docker
```

Or use the script directly:

```bash
sh ./scripts/prod.sh
```

## 📜 Available Scripts

### Development

```bash
npm run dev          # Start with hot-reload (Node.js --watch)
npm run dev:docker   # Start with Docker + Neon Local
```

### Production

```bash
npm run start        # Start production server
npm run prod:docker  # Start with Docker + Neon Cloud
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run format       # Format code with Prettier
npm run format:check # Check formatting
```

### Testing

```bash
npm test             # Run test suite
```

### Database

```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Drizzle Studio
```

## 🐳 Docker Commands

### Development (Neon Local)

```bash
# Start services
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down

# Rebuild containers
docker-compose -f docker-compose.dev.yml up --build

# Access container shell
docker exec -it acquisitions-app-dev sh

# Run migrations in container
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate
```

### Production (Neon Cloud)

```bash
# Start production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Stop services
docker-compose -f docker-compose.prod.yml down

# Check status
docker-compose -f docker-compose.prod.yml ps
```

## 📁 Project Structure

```
.
├── src/                    # Source code
│   ├── config/            # Configuration files
│   │   ├── arcjet.js
│   │   ├── database.js
│   │   ├── env.js
│   │   └── logger.js
│   ├── controllers/       # Route controllers
│   │   ├── auth.controller.js
│   │   ├── hume-evi.controller.js
│   │   ├── jobs.controller.js
│   │   └── users.controller.js
│   ├── jobs/               # Job queue (BullMQ)
│   │   ├── types/         # Job implementations
│   │   │   ├── base.job.js
│   │   │   ├── email.job.js
│   │   │   └── phone-call.job.js
│   │   ├── jobs.executor.js
│   │   ├── jobs.queue.js
│   │   └── jobs.registry.js
│   ├── middleware/        # Express middleware
│   │   ├── auth.middleware.js
│   │   └── security.middleware.js
│   ├── models/            # Drizzle ORM models
│   │   ├── job.model.js
│   │   └── user.model.js
│   ├── routes/            # API routes
│   │   ├── auth.routes.js
│   │   ├── hume-test.routes.js
│   │   ├── jobs.routes.js
│   │   └── users.routes.js
│   ├── server/            # Server setup
│   │   └── hume-websocket.server.js
│   ├── services/          # Business logic
│   │   ├── auth.service.js
│   │   ├── hume-evi-config.service.js
│   │   ├── hume-evi.service.js
│   │   ├── jobs.service.js
│   │   ├── twilio.service.js
│   │   └── users.service.js
│   ├── utils/             # Utility functions
│   │   ├── cookies.js
│   │   ├── format.js
│   │   └── jwt.js
│   ├── validations/       # Zod schemas
│   │   ├── auth.validation.js
│   │   ├── jobs.validation.js
│   │   └── users.validation.js
│   ├── views/             # HTML views
│   │   └── hume-test.html
│   ├── app.js
│   ├── index.js
│   └── server.js
├── tests/                 # Test files
│   └── app.test.js
├── scripts/               # Helper scripts
│   ├── dev.sh
│   └── prod.sh
├── drizzle/               # Migration files
├── .github/               # GitHub Actions workflows
│   └── workflows/
│       ├── lint-and-format.yml
│       ├── tests.yml
│       └── docker-build-and-push.yml
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.dev.yml # Development setup
├── docker-compose.prod.yml # Production setup
├── .dockerignore          # Docker ignore file
├── DOCKER_SETUP.md        # Docker documentation
└── package.json           # Dependencies & scripts
```

## 🔐 API Endpoints

### Health Check

```bash
GET /health
```

Returns:

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### Authentication

```bash
POST /api/auth/sign-up  # Register new user
POST /api/auth/sign-in      # Login user
POST /api/auth/sign-out     # Logout user
GET  /api/auth/me         # Get current user
```

### Users

```bash
GET    /api/users         # Get all users (protected)
GET    /api/users/:id     # Get user by ID (protected)
PUT    /api/users/:id     # Update user (protected)
DELETE /api/users/:id     # Delete user (protected)
```

### Hume EVI (Empathic Voice Interface)

```bash
GET  /api/test-hume              # Hume EVI test UI
GET  /api/test-hume/config       # Get default configuration
POST /api/test-hume/config/validate      # Validate configuration parameters
POST /api/test-hume/config/create        # Create new Hume EVI configuration (returns config ID)
POST /api/test-hume/call                 # Create phone call job (all calls use BullMQ)
                                          # @body {string|string[]} toNumber - Phone number(s) in E.164 format
                                          # @body {Object} [config] - Optional Hume EVI configuration
                                          # @body {string} [configId] - Optional existing config ID
POST /api/test-hume/twilio-webhook       # Twilio webhook endpoint
```

### Jobs

```bash
POST /api/jobs          # Create a job (email, phone-call)
GET  /api/jobs          # Get all jobs with optional filters
GET  /api/jobs/:id      # Get job by ID
GET  /api/jobs/types    # Get available job types
GET  /api/jobs/stats    # Get job statistics
```

## 🧪 Testing

The project uses Jest for testing with `--experimental-vm-modules` for ES Module support.

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## 🔄 Database Migrations

### Generate Migration

After modifying models in `src/models/`:

```bash
npm run db:migrate
```

This will:

1. Generate SQL migration in `drizzle/`
2. Apply it to your database

### Run Migrations

```bash
npm run db:migrate
```

### Open Drizzle Studio

```bash
npm run db:studio
```

Opens UI at http://localhost:4983 to browse and edit data.

## 🚢 CI/CD

The project includes GitHub Actions workflows:

### 1. Lint and Format (`lint-and-format.yml`)

- Runs on push/PR to `main` and `staging`
- Checks ESLint and Prettier compliance
- Provides fix suggestions

### 2. Tests (`tests.yml`)

- Runs on push/PR to `main` and `staging`
- Executes Jest test suite
- Uploads coverage reports
- Shows coverage percentage

### 3. Docker Build and Push (`docker-build-and-push.yml`)

- Runs on push to `main` or manual trigger
- Builds multi-platform Docker images (linux/amd64, linux/arm64)
- Pushes to Docker Hub with metadata tags

See [.github/workflows/README.md](.github/workflows/README.md) for details.

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3001
lsof -ti:3001 | xargs kill -9

# Check what's using port 5432
lsof -ti:5432 | xargs kill -9
```

### Docker Issues

```bash
# Stop all containers
docker-compose -f docker-compose.dev.yml down -v

# Rebuild from scratch
docker-compose -f docker-compose.dev.yml up --build

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Database Connection

```bash
# Check Neon Local logs
docker-compose -f docker-compose.dev.yml logs db

# Test connection
docker-compose -f docker-compose.dev.yml exec db psql -U neon -d neondb -c 'SELECT 1'
```

### Reset Everything

```bash
# Stop containers and remove volumes
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.prod.yml down -v

# Delete node_modules
rm -rf node_modules package-lock.json

# Fresh install
npm install
```

## 📚 Documentation

- [Docker Setup Guide](DOCKER_SETUP.md) - Detailed Docker instructions
- [GitHub Actions Workflows](.github/workflows/README.md) - CI/CD documentation

## 🛡️ Security Features

- **Helmet**: HTTP security headers
- **Arcjet**: Bot detection and rate limiting
- **JWT**: Secure token-based authentication
- **Bcrypt**: Password hashing
- **Cookie Parser**: Secure cookie handling
- **CORS**: Cross-origin resource sharing configured
- **Environment Variables**: Sensitive data never hardcoded

## 🎯 Tech Stack

- **Runtime**: Node.js 20.x
- **Framework**: Express.js 5.x
- **Database**: Neon (PostgreSQL) + Drizzle ORM
- **Validation**: Zod
- **Security**: Arcjet, Helmet, JWT, Bcrypt
- **Logging**: Winston + Morgan
- **Testing**: Jest + Supertest
- **Linting**: ESLint + Prettier
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Job Queue**: BullMQ with Redis
- **AI Integration**: Hume AI EVI (Empathic Voice Interface)
- **Voice Calls**: Twilio integration for outbound calls

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:

- Open an issue on [GitHub](https://github.com/amo613/Testing/issues)
- Check the [Docker Setup Guide](DOCKER_SETUP.md) for Docker-related questions
- Review [CI/CD Workflows](.github/workflows/README.md) for automation details

---
