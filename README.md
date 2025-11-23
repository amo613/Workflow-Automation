# Workflow Builder - Universal Automation Platform

A powerful, visual workflow automation platform that lets you build complex business processes with a drag-and-drop interface. Connect APIs, automate tasks, trigger actions, and orchestrate multi-step workflows with ease. Perfect for sales automation, customer support, data processing, and any scenario where you need to automate repetitive tasks.

## 🎯 What is This?

Think of this as your **no-code automation toolkit** - but with the power and flexibility of code when you need it. Build workflows visually, connect to your favorite services (Google, HubSpot, Twilio, OpenAI), and let the system handle the rest.

**Key Features:**

- **Visual Workflow Editor**: Drag-and-drop interface powered by React Flow
- **20+ Node Types**: From simple HTTP requests to AI-powered agents
- **Real-time Execution**: Watch your workflows run live with animated visualizations
- **Trigger-Based**: Start workflows via webhooks, schedules, Google Sheets changes, HubSpot events, or phone calls
- **AI Integration**: Built-in OpenAI integration for intelligent automation
- **Production-Ready**: Dockerized, scalable, and battle-tested

## 🏗️ Architecture Overview

This is a **full-stack application** with a hybrid architecture:

- **Backend**: Node.js with Fastify, and express for BullMQ setup - migrated from initially only express. Within the future, the backend might be rewritten in Go for even better performance.
- **Frontend**: React + Vite with React Flow for visual workflow editing
- **Workflow Engine**: Inngest for complex multi-step workflows, BullMQ for simple jobs
- **Database**: PostgreSQL (Neon) with Drizzle ORM and PGvector extenstion, for a RAG Based Knowledge Base.
- **Cache**: Redis for caching and job queues
- **Queue and Job System**: Whole Workflow Executions are done by Inngest, simple executions within the node, or the tools for call agents, are done by BullMQ to save API Requests.
- **Containerization**: Docker with separate dev/prod configurations

### How Workflows Work

1. **Design**: Create workflows visually in the React Flow editor
2. **Trigger**: Workflows start via triggers (webhook, schedule, Google Sheets, HubSpot, phone call)
3. **Execute**: Inngest orchestrates the execution, running nodes sequentially or in parallel
4. **Monitor**: Real-time execution tracking with live updates in the UI

## 📋 Prerequisites

Before you start, make sure you have:

- **Node.js** >= 20.x
- **Docker** & Docker Compose (for containerized development)
- **npm**
- **Inngest Dev Server** (for local development) - install with `npm install inngest`

### Optional Services (for full functionality):

- **OpenAI API Key** - for AI Agent nodes
- **Twilio Account** - for phone call automation
- **Google Cloud Console** - for Calendar and Sheets integration
- **HubSpot Account** - for CRM automation
- **Neon Account** - for production database (or use Neon Local for dev)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/amo613/Testing.git
cd Testing
```

### 2. Install Dependencies

```bash
npm install
cd ui && npm install && cd ..
```

### 3. Environment Setup

Create `.env.development` in the root directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
FRONTEND_URL=http://localhost:3001

# Database (automatically set by docker-compose.dev.yml)
DATABASE_URL=postgres://neon:npg@neon-local:5432/neondb

# JWT Configuration
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=15m

# OpenAI (optional - for AI Agent nodes)
OPENAI_API_KEY=your-openai-api-key-here

# Twilio (optional - for phone call automation)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Google Calendar & Sheets (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/integrations/google-calendar/callback

# HubSpot (optional - for CRM automation)
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URI_BASE=http://localhost:3001
HUBSPOT_APP_ID=your-hubspot-app-id

# Inngest (required for workflow execution)
INNGEST_APP_ID=acquisitions-app
# Note: No signing keys needed in development - uses local dev server

# ngrok (optional - for webhook exposure)
NGROK_AUTH_TOKEN=your-ngrok-auth-token

# Arcjet (optional - for rate limiting and bot detection)
ARCJET_KEY=your-arcjet-key-here

# Redis (automatically set by docker-compose)
REDIS_URL=redis://redis:6379
```

### 4. Start Development Environment

**Option A: Using the Script (Recommended)**

```bash
npm run dev:docker
```

This script:

- Checks for Docker
- Creates necessary directories
- Starts Docker Compose with Neon Local, Redis, and the app
- Runs database migrations automatically
- Shows logs

**Option B: Manual Docker Compose**

```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate

# View logs
docker-compose -f docker-compose.dev.yml logs -f app
```

**Option C: Local Development (without Docker)**

```bash
# Start Inngest Dev Server (required!)
npx inngest-cli@latest dev

# In another terminal, start the app
npm run dev

# In another terminal, start the UI
npm run ui:dev
```

### 5. Access the Application

- **Application**: http://localhost:3001
- **Database**: postgres://neon:npg@localhost:5432/neondb
- **Redis**: localhost:6379
- **Inngest Dev Server**: http://localhost:8288 (if running locally)

## 🐳 Docker Setup Explained

### Development (`docker-compose.dev.yml`)

The development setup includes:

- **Neon Local**: Ephemeral PostgreSQL database that creates branches per git branch
- **Redis**: For caching and job queues
- **App Container**: Hot-reload enabled, source code mounted as volume

**Key Features:**

- Source code changes reflect immediately (hot-reload)
- Database branches per git branch (via Neon Local)
- Automatic migrations on startup
- Full development tooling available

### Production (`docker-compose.prod.yml`)

The production setup is optimized for:

- **Performance**: Multi-stage Docker build, production dependencies only
- **Security**: Non-root user, minimal attack surface
- **Reliability**: Health checks, restart policies, resource limits
- **Scalability**: Ready for orchestration (Kubernetes, Docker Swarm)

**Key Differences:**

- No source code mounting (uses built image)
- Production dependencies only
- Resource limits configured
- Health checks enabled

### Dockerfile Explained

The Dockerfile uses a **multi-stage build**:

1. **Base Stage**: Installs Node.js, Chromium (for Puppeteer), and dependencies
2. **Development Stage**: Includes dev dependencies, hot-reload enabled
3. **Production Stage**: Strips dev dependencies, optimized for size

**Special Features:**

- Chromium pre-installed for Web Scraper nodes (Puppeteer)
- UI built during image creation
- Non-root user for security
- Health check endpoint

## 📜 Scripts Explained

### Development Scripts

```bash
npm run dev              # Start with hot-reload (Node.js --watch)
npm run dev:docker       # Start full dev environment (Docker + Neon + Redis)
npm run ui:dev           # Start UI development server (Vite)
```

**`dev.sh`** - The development script does:

1. Checks for `.env.development` file
2. Verifies Docker is running
3. Creates `.neon_local` directory for database persistence
4. Starts Docker Compose services
5. Waits for database to be ready
6. Generates and runs migrations
7. Shows logs

### Production Scripts

```bash
npm run start            # Start production server
npm run prod:docker      # Start production environment
```

**`prod.sh`** - The production script:

1. Checks for `.env.production` file
2. Verifies Docker is running
3. Builds and starts production containers
4. Waits for services to be ready
5. Migrations run automatically on app startup

### Database Scripts

```bash
npm run db:generate      # Generate migration files from schema changes
npm run db:migrate       # Apply migrations to database
npm run db:studio        # Open Drizzle Studio (database GUI)
```

### Code Quality Scripts

```bash
npm run lint             # Check code with ESLint
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
```

## 🎨 Node Types Overview

The platform includes **20+ node types** organized into categories:

### Trigger Nodes

**Start workflows automatically based on events:**

- **Webhook Trigger**: Start workflows via HTTP POST requests
- **Schedule Trigger**: Run workflows on a cron schedule
- **Google Sheets Trigger**: Detect changes in Google Sheets (new/updated rows)
- **HubSpot Trigger**: React to HubSpot events (contact creation, property changes, etc.)
- **Call Trigger**: Start workflows when receiving phone calls via Twilio

### Action Nodes

**Perform operations in your workflows:**

- **HTTP Request**: Make API calls to any service
- **Database Query**: Execute SQL queries against your PostgreSQL database
- **Email**: Send emails via SMTP (supports custom credentials)
- **Google Sheets**: Read/write data to Google Sheets
- **HubSpot**: Create/update contacts, companies, and manage lists
- **Web Scraper**: Extract data from websites (supports Puppeteer for JavaScript-heavy sites)
- **AI Agent**: Use OpenAI to process data, make decisions, or generate content
- **Call Agent**: Make outbound phone calls with AI-powered voice assistants
- **Knowledge Base Query**: Search through your knowledge base for context

### Control Flow Nodes

**Control how workflows execute:**

- **If**: Conditional branching (if/then/else)
- **Wait**: Pause execution for a specified duration
- **Merge**: Combine multiple workflow branches back together
- **Variable Set**: Store values for use in later nodes

### Special Nodes

- **Start**: Entry point for manually triggered workflows
- **End**: Exit point that collects final results

## 🔥 Interesting & Unique Nodes

### 1. **Web Scraper Node**

One of the most powerful nodes - scrapes websites with multiple modes:

- **Static Content**: Fast extraction using `node-html-parser` for simple sites
- **Dynamic Content**: Full browser automation with Puppeteer for JavaScript-heavy sites
- **Google Maps Integration**: Special handling for Google Maps place and search information
- **Smart List Detection**: Automatically detects and extracts list structures
- **Text Search**: Keyword-based content extraction
- **Screenshot Support**: Capture visual snapshots of pages

**Use Cases:**

- Monitor competitor prices
- Extract product information
- Scrape job listings
- Collect data from dynamic websites

### 2. **Call Agent Node**

Make AI-powered phone calls with OpenAI's Realtime API:

- **Voice-to-Voice**: Real-time conversation with AI
- **Tool Integration**: AI can access Google Calendar, create events, send emails
- **Knowledge Base**: AI can reference your knowledge base during calls
- **Custom Prompts**: Use existing workflows as conversation context
- **Twilio Integration**: Handles audio streaming, interruptions, and turn-taking

**Use Cases:**

- Automated customer support calls
- Appointment scheduling
- Lead qualification
- Follow-up calls

### 3. **AI Agent Node**

Process data with OpenAI's GPT models:

- **Context-Aware**: Access to previous node outputs and workflow variables
- **Tool Calling**: Can use Google Calendar, Email, and other tools
- **Custom Instructions**: Define AI behavior per workflow
- **Temperature Control**: Adjust creativity vs. consistency
- **Token Management**: Control response length and costs

**Use Cases:**

- Data transformation and cleaning
- Content generation
- Decision making
- Natural language processing

### 4. **Google Sheets Trigger**

Monitor Google Sheets for changes:

- **Row Detection**: Detects new or updated rows
- **Incremental Processing**: Only processes changed rows (uses row hashing)
- **Polling-Based**: Checks for changes at configurable intervals
- **Atomic Operations**: Prevents duplicate processing with Redis locks

**Use Cases:**

- Process form submissions
- Sync data from spreadsheets
- Trigger workflows from manual data entry
- Monitor shared spreadsheets

### 5. **HubSpot Integration**

Full CRM automation:

- **Contact Management**: Create, update, and retrieve contacts
- **Company Management**: Manage company records
- **List Management**: Add contacts to lists
- **Webhook Triggers**: React to HubSpot events in real-time
- **OAuth 2.0**: Secure authentication with HubSpot

**Use Cases:**

- Sync leads from forms
- Update contact properties
- Trigger workflows on CRM events
- Automate sales processes

### 6. **Merge Node**

Combine parallel workflow branches:

- **Data Merging**: Combines outputs from multiple branches
- **Variable Preservation**: Maintains variables from all branches
- **Conflict Resolution**: Handles overlapping variable names
- **Flexible**: Works with any number of input branches

**Use Cases:**

- Parallel API calls
- A/B testing workflows
- Combining multiple data sources
- Fan-out/fan-in patterns

## 🔧 Configuration Deep Dive

### Inngest Setup

**Why Inngest?** It handles complex workflow orchestration with automatic retries, step-by-step execution, and better observability than simple job queues.

**Development:**

1. Install Inngest CLI: `npm install inngest`
2. Start dev server: `npx inngest-cli@latest dev`
3. The app automatically connects to `http://host.docker.internal:8288`

**Production:**

1. Create account at [inngest.com](https://www.inngest.com)
2. Create an app and get your App ID
3. Get Signing Key and Event Key from dashboard
4. Set environment variables:
   ```env
   INNGEST_APP_ID=your-app-id
   INNGEST_SIGNING_KEY=your-signing-key
   INNGEST_EVENT_KEY=your-event-key
   ```
5. Configure App URL in Inngest dashboard (must be publicly accessible)

### Google Cloud Console Setup

For Google Calendar and Sheets integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google Calendar API** and **Google Sheets API**
4. Create OAuth 2.0 credentials (Web Application)
5. Add authorized redirect URIs:
   - `http://localhost:3001/api/integrations/google-calendar/callback`
   - `http://localhost:3001/api/integrations/google-sheets/callback`
6. Add your production domain for production use
7. Copy Client ID and Client Secret to `.env`

### HubSpot Setup

For CRM automation:

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com)
2. Create a new app
3. Configure OAuth scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.lists.read`
   - `crm.lists.write`
4. Set redirect URI: `http://localhost:3001/api/integrations/hubspot/callback`
5. Copy Client ID, Client Secret, and App ID to `.env`
6. For webhooks, configure the webhook URL in HubSpot App Settings: Use the uri from the hubspot node and add it there, use contact and companies for event abonnements

### Twilio Setup

For phone call automation:

1. Create account at [Twilio](https://www.twilio.com)
2. Get Account SID and Auth Token
3. get your phone number
4. Configure webhook URL for incoming calls (local dev won't work since it needs an accessable server.)
5. Add credentials to `.env` or configure per-user in the UI

## 📁 Project Structure

```
.
├── src/                          # Backend source code
│   ├── config/                   # Configuration files
│   │   ├── inngest.js           # Inngest client setup
│   │   ├── database.js          # Drizzle ORM config
│   │   └── cache.js             # Redis cache config
│   ├── controllers/             # Route controllers
│   ├── services/                # Business logic
│   │   └── full-workflow/       # Workflow engine
│   │       ├── executor.service.js      # Workflow execution
│   │       ├── trigger.service.js       # Workflow triggering
│   │       ├── inngest-functions.js     # Inngest function definitions
│   │       └── node-handlers/           # Individual node implementations
│   ├── routes/                  # API routes (Fastify)
│   ├── models/                  # Database models (Drizzle)
│   ├── middleware/              # Express/Fastify middleware
│   └── tools/                   # OpenAI function tools
├── ui/                          # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   └── full-workflow/   # Workflow editor components
│   │   ├── pages/               # Page components
│   │   └── services/            # API client services
│   └── package.json
├── scripts/                     # Helper scripts
│   ├── dev.sh                   # Development startup script
│   └── prod.sh                  # Production startup script
├── docker-compose.dev.yml       # Development Docker setup
├── docker-compose.prod.yml      # Production Docker setup
├── Dockerfile                   # Multi-stage Docker build
└── package.json                 # Backend dependencies
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth with 15-minute expiration
- **CSRF Protection**: Intelligent CSRF protection (auto-detects API vs browser clients)
- **Rate Limiting**: Arcjet integration for bot detection and rate limiting
- **Helmet**: Security headers for HTTP protection
- **Bcrypt**: Password hashing
- **Origin Validation**: Additional security layer for webhooks
- **Non-root Docker User**: Containers run as non-root for security

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## 🚢 Deployment

### Production Checklist

- [ ] Set all required environment variables in `.env.production`
- [ ] Configure Inngest production keys
- [ ] Set up production database (Neon Cloud or self-hosted PostgreSQL)
- [ ] Configure domain and SSL certificates
- [ ] Update OAuth redirect URIs in Google Cloud Console
- [ ] Configure HubSpot webhook URLs
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy for database

### Docker Production Deployment

```bash
# Build and start
npm run prod:docker

# Or manually
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Stop
docker-compose -f docker-compose.prod.yml down
```

## 🐛 Troubleshooting

### Workflows Not Executing

1. **Check Inngest**: Ensure Inngest dev server is running (dev) or cloud is configured (prod)
2. **Check Logs**: `docker-compose logs -f app` for execution errors
3. **Check Database**: Ensure migrations are applied
4. **Check Redis**: Ensure Redis is running and accessible

### Database Connection Issues

```bash
# Check Neon Local logs
docker-compose -f docker-compose.dev.yml logs neon-local

# Test connection
docker-compose -f docker-compose.dev.yml exec neon-local psql -U neon -d neondb -c 'SELECT 1'
```

### Port Conflicts

```bash
# Check what's using port 3001
lsof -ti:3001 | xargs kill -9

# Check what's using port 5432
lsof -ti:5432 | xargs kill -9
```

### Reset Everything

```bash
# Stop and remove all containers and volumes
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.prod.yml down -v

# Remove node_modules
rm -rf node_modules ui/node_modules

# Fresh install
npm install && cd ui && npm install && cd ..
```

## 📚 Additional Documentation

- [Inngest Integration Guide](INNGEST.md) - Detailed Inngest setup and usage
- [Docker Setup Guide](DOCKER_SETUP.md) - Docker-specific instructions
- [Cache Middleware](CACHE_MIDDLEWARE.md) - Caching strategy documentation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

---

**Built with ❤️ for automation enthusiasts**
