# Testing - Universal API Library / OpenAI Realtime Voice Assistant API

A high-performance, production-ready Node.js API server for OpenAI Realtime Voice Assistant with Twilio integration, Google Calendar support, and comprehensive security features. Built with Express.js, Drizzle ORM, and Docker support. Will be used for as a tool service for all kind of stuff. Sales, assistant, recruiter etc.

## 🚀 Features

- **Fast & Performant**: Built with Express.js and optimized middleware
- **Secure**: Helmet, Arcjet, authentication & authorization
- **Scalable**: Dockerized with multi-stage builds
- **OpenAI Realtime API Integration**: Real-time voice assistant with WebSocket support
- **Twilio Voice Calls**: Outbound phone calls with real-time audio streaming
- **Google Calendar Integration**: OAuth 2.0 authentication with calendar event management
- **Hybrid Authentication**: Support for Bearer Token (API clients) and Cookie-based (Browser) authentication
- **CSRF Protection**: Intelligent CSRF protection that automatically detects API vs Browser clients
- **Job Queue System**: BullMQ-based job queue for async operations (email, phone calls)
- **Secure**: Helmet, Arcjet, JWT authentication, CSRF tokens, origin validation
- **Scalable**: Dockerized with multi-stage builds, Redis caching
- **Modern Stack**: ES Modules, Drizzle ORM, Zod validation
- **Developer Experience**: Hot-reload, ESLint, Prettier, Jest
- **CI/CD Ready**: GitHub Actions for linting, testing, and Docker builds
- **Database**: Neon (PostgreSQL) with local development support

## 📋 Prerequisites

- **Node.js** >= 20.x
- **Docker** & Docker Compose (for containerized runs)
- **PostgreSQL** (via Neon Local or Neon Cloud)
- **Redis** (for job queue and caching)
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
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
FRONTEND_URL=http://localhost:3001 // or use directly ngrok

# Database Configuration (Set by docker-compose.dev.yml automatically)
DATABASE_URL=postgres://neon:npg@neon-local:5432/neondb

# JWT Configuration
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=15m

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_URL=

# Google Calendar Integration (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/integrations/google-calendar/callback

# ngrok Configuration (for Twilio webhooks)
NGROK_AUTH_TOKEN=your-ngrok-auth-token

# Arcjet Configuration
ARCJET_KEY=your-arcjet-key-here

# Neon API Configuration
NEON_API_KEY=your-neon-api-key-here
NEON_PROJECT_ID=your-neon-project-id-here
# Redis Configuration (set by docker-compose automatically)
REDIS_URL=redis://redis:6379
```

### 4. Run Database Migrations

```bash
# Inside Docker container
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate

# Or locally (if running without Docker)
npm run db:migrate
```

### 5. Start the Application

**Option A: Docker Development (Recommended)**

```bash
npm run dev:docker
```

Or use the script directly:

```bash
sh ./scripts/dev.sh
```

This starts:

- Application server (port 3001)
- Redis (port 6379)
- Neon Local PostgreSQL (port 5432)
- ngrok tunnel (for Twilio webhooks)

**Option B: Production Mode**

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
npm run dev:docker   # Start with Docker + Neon Local + Redis
```

### Production

```bash
npm run start        # Start production server
npm run prod:docker  # Start with Docker + Neon Cloud + Redis
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
npm test -- --coverage  # Run with coverage
```

### Database

```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Drizzle Studio
```

## 🐳 Docker Commands

### Development

```bash
# Start services
docker-compose -f docker-compose.dev.yml up

# Start in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop services
docker-compose -f docker-compose.dev.yml down

# Rebuild containers
docker-compose -f docker-compose.dev.yml up --build

# Access container shell
docker exec -it acquisitions-app-dev sh

# Run migrations
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate
```

### Production

```bash
# Start production
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Stop services
docker-compose -f docker-compose.prod.yml down
```

## 📁 Project Structure

```
.
├── src/
│   ├── config/              # Configuration files
│   │   ├── arcjet.js        # Arcjet security config
│   │   ├── cache.js         # Redis cache config
│   │   ├── database.js      # Drizzle ORM config
│   │   ├── env.js           # Environment variables
│   │   └── logger.js        # Winston logger config
│   ├── controllers/        # Route controllers
│   │   ├── auth.controller.js
│   │   ├── google-calendar.controller.js
│   │   ├── jobs.controller.js
│   │   ├── openai-realtime.controller.js
│   │   └── users.controller.js
│   ├── jobs/                # Job queue (BullMQ)
│   │   ├── types/           # Job implementations
│   │   │   ├── base.job.js
│   │   │   ├── email.job.js
│   │   │   └── phone-call.job.js
│   │   ├── jobs.executor.js
│   │   ├── jobs.queue.js
│   │   └── jobs.registry.js
│   ├── middleware/          # Express middleware
│   │   ├── auth.middleware.js      # JWT authentication
│   │   ├── cache.middleware.js     # Cache middleware
│   │   ├── csrf.middleware.js      # CSRF protection
│   │   └── security.middleware.js  # Rate limiting & bot detection
│   ├── models/              # Drizzle ORM models
│   │   ├── integration.model.js   # Google Calendar integrations
│   │   ├── job.model.js
│   │   └── user.model.js
│   ├── public/js/           # Frontend JavaScript
│   │   └── openai-test/      # OpenAI Realtime test UI
│   ├── routes/               # API routes
│   │   ├── auth.routes.js
│   │   ├── cache.routes.js
│   │   ├── google-calendar.routes.js
│   │   ├── jobs.routes.js
│   │   ├── openai-test.routes.js
│   │   └── users.routes.js
│   ├── server/               # WebSocket servers
│   │   ├── twilio-openai-proxy/  # Twilio-OpenAI proxy modules
│   │   │   ├── call-state.js
│   │   │   ├── openai-handlers.js
│   │   │   ├── openai-session.js
│   │   │   └── twilio-handlers.js
│   │   ├── openai-websocket.server.js      # Browser WebSocket server
│   │   └── twilio-openai-proxy.server.js   # Twilio WebSocket server
│   ├── services/             # Business logic
│   │   ├── auth.service.js
│   │   ├── google-calendar.service.js
│   │   ├── google-oauth.service.js
│   │   ├── jobs.service.js
│   │   ├── openai-realtime-config.service.js
│   │   ├── twilio.service.js
│   │   └── users.service.js
│   ├── tools/                 # OpenAI tools/functions
│   │   ├── calendar.handlers.js    # Google Calendar tool handlers
│   │   ├── calendar.tools.js      # Tool declarations
│   │   ├── tools.registry.js       # Tool registry
│   │   └── types.js                # Internal function names
│   ├── utils/                 # Utility functions
│   │   ├── audio-converter.js      # Audio format conversion
│   │   ├── cache.utils.js
│   │   ├── cookies.js
│   │   ├── format.js
│   │   ├── jwt.js
│   │   ├── ngrok.service.js
│   │   └── openai-tools.utils.js   # Shared tool loading/execution
│   ├── validations/           # Zod schemas
│   │   ├── auth.validation.js
│   │   ├── jobs.validation.js
│   │   └── users.validation.js
│   ├── views/                 # HTML views
│   │   ├── login.html
│   │   └── openai-test.html
│   ├── app.js                 # Express app setup
│   ├── index.js               # Application entry point
│   └── server.js              # HTTP server + WebSocket setup
├── tests/                     # Test files
│   └── app.test.js
├── scripts/                   # Helper scripts
│   ├── dev.sh
│   └── prod.sh
├── drizzle/                   # Migration files
├── .github/workflows/         # GitHub Actions workflows
├── Dockerfile                  # Multi-stage Docker build
├── docker-compose.dev.yml     # Development setup
├── docker-compose.prod.yml    # Production setup
└── package.json               # Dependencies & scripts
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
  "uptime": 123.456,
  "cache": { "status": "connected" }
}
```

### Authentication

**Hybrid Authentication Support:**

- **Bearer Token** (for API clients): `Authorization: Bearer <jwt-token>`
- **Cookie Header** (for API clients): `Cookie: token=<jwt-token>`
- **HTTP Cookie** (for browsers): Automatic cookie handling

```bash
POST /api/auth/sign-up    # Register new user
POST /api/auth/sign-in    # Login user (returns JWT token in cookie)
POST /api/auth/sign-out   # Logout user
```

**Example with HTTPie:**

```bash
# Login
http POST http://localhost:3001/api/auth/sign-in email="user@example.com" password="password"

# Use Bearer Token
http -A bearer:<jwt-token> GET http://localhost:3001/api/users

# Or use Cookie Header
http GET http://localhost:3001/api/users "Cookie: token=<jwt-token>"
```

### Users

```bash
GET    /api/users         # Get all users (admin only)
GET    /api/users/:id     # Get user by ID (authenticated)
PUT    /api/users/:id     # Update user (authenticated)
DELETE /api/users/:id     # Delete user (admin only)
```

### OpenAI Realtime API

```bash
# Browser WebSocket
WS /api/openai-realtime/connect?sessionId=<uuid>&token=<jwt-token>

# Test UI
GET  /api/test-openai                                    # OpenAI test UI
GET  /api/test-openai/config                            # Get default configuration
POST /api/test-openai/config/validate                   # Validate configuration
POST /api/test-openai/call                              # Create phone call job
      # @body {string|string[]} toNumber - Phone number(s) in E.164 format
      # @body {Object} [config] - Optional OpenAI Realtime API configuration
POST /api/test-openai/twilio-webhook                    # Twilio webhook endpoint
```

### Jobs

```bash
POST /api/jobs          # Create a job (email, phone-call)
GET  /api/jobs          # Get all jobs with optional filters
GET  /api/jobs/:id      # Get job by ID
GET  /api/jobs/types    # Get available job types
GET  /api/jobs/stats    # Get job statistics
```

### Google Calendar Integration

```bash
GET  /api/integrations/google-calendar/auth         # Initiate OAuth flow
GET  /api/integrations/google-calendar/callback    # OAuth callback
GET  /api/integrations/google-calendar/status      # Get integration status
PUT  /api/integrations/google-calendar/settings    # Update settings (timezone, mode, etc.)
DELETE /api/integrations/google-calendar           # Disconnect integration
```

**Available Tools (via OpenAI):**

- `googleCalendarListEvents` - List calendar events
- `googleCalendarCreateEvent` - Create new event
- `googleCalendarUpdateEvent` - Update existing event (Personal Assistant mode)
- `googleCalendarDeleteEvent` - Delete event (Personal Assistant mode)

## 🔐 Authentication & Security

### Hybrid Authentication

The API supports three authentication methods:

1. **Bearer Token** (API Clients)

   ```
   Authorization: Bearer <jwt-token>
   ```

   - No CSRF token required
   - For Postman, curl, HTTPie, etc.

2. **Cookie Header** (API Clients)

   ```
   Cookie: token=<jwt-token>
   ```

   - No CSRF token required
   - For API clients that prefer cookie format

3. **HTTP Cookie** (Browsers)
   - Automatic cookie handling
   - CSRF token required for state-changing requests
   - For browser-based applications

### CSRF Protection

The system automatically detects API clients vs browser clients:

- **API Clients**: CSRF protection skipped (Bearer tokens and Cookie headers are CSRF-safe)
- **Browser Clients**: CSRF token required for POST/PUT/DELETE/PATCH requests

CSRF token is automatically generated on GET requests and must be sent in:

- Header: `X-CSRF-Token: <token>`
- Or Body: `{ "_csrf": "<token>" }`

### Security Features

- **Helmet**: HTTP security headers
- **Arcjet**: Bot detection and rate limiting
- **JWT**: Secure token-based authentication (15-minute expiration)
- **CSRF Protection**: Intelligent CSRF protection with automatic client detection
- **Origin/Referer Validation**: Additional security layer
- **Bcrypt**: Password hashing
- **Cookie Security**: `httpOnly`, `secure`, `sameSite: 'lax'` for auth cookies
- **CORS**: Cross-origin resource sharing configured

## 🎯 Tech Stack

- **Runtime**: Node.js 20.x
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Cache**: Redis (BullMQ + caching)
- **Validation**: Zod
- **Security**: Arcjet, Helmet, JWT, Bcrypt, CSRF Protection
- **Logging**: Winston + Morgan
- **Testing**: Jest + Supertest
- **Linting**: ESLint + Prettier
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Job Queue**: BullMQ with Redis
- **AI Integration**: OpenAI Realtime API
- **Voice Calls**: Twilio Voice API with Media Streams
- **Calendar**: Google Calendar API with OAuth 2.0
- **Tunneling**: ngrok for webhook exposure

## 🌐 WebSocket Endpoints

### Browser Client (OpenAI Realtime)

```
WS /api/openai-realtime/connect?sessionId=<uuid>&token=<jwt-token>
```

- Real-time voice assistant for browser clients
- Supports tool calls (Google Calendar integration)
- Automatic response after tool execution

### Twilio Media Stream (OpenAI Proxy)

```
WS /ws/openai/call?callSid=<twilio-call-sid>
```

- Real-time audio proxy between Twilio and OpenAI
- Handles audio format conversion (μ-law ↔ PCM)
- Supports interruptions and turn-taking
- Tool calls fully supported

## 🧪 Testing

The project uses Jest for testing with ES Module support.

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
npm run db:generate
```

This generates SQL migration files in `drizzle/`.

### Run Migrations

```bash
# Inside Docker container
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate

# Or locally
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

### 2. Tests (`tests.yml`)

- Runs on push/PR to `main` and `staging`
- Executes Jest test suite
- Uploads coverage reports

### 3. Docker Build and Push (`docker-build-and-push.yml`)

- Runs on push to `main` or manual trigger
- Builds multi-platform Docker images
- Pushes to Docker Hub

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
docker-compose -f docker-compose.dev.yml logs -f app
```

### Database Connection

```bash
# Check Neon Local logs
docker-compose -f docker-compose.dev.yml logs neon-local

# Test connection
docker-compose -f docker-compose.dev.yml exec neon-local psql -U neon -d neondb -c 'SELECT 1'
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
- [Cache Middleware](CACHE_MIDDLEWARE.md) - Cache middleware documentation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

ISC

## 📞 Support

For issues and questions:

- Open an issue on [GitHub](https://github.com/amo613/Testing/issues)
- Check the [Docker Setup Guide](DOCKER_SETUP.md) for Docker-related questions

---
