# Railway Deployment Guide

This guide explains how to deploy the application to Railway.app.

## Prerequisites

1. **Railway CLI** installed:
   ```bash
   npm install -g @railway/cli
   ```

2. **Railway Account** (sign up at https://railway.app)

3. **GitHub Repository** (Railway can deploy directly from GitHub)

## Quick Start

### Option 1: Railway CLI (Recommended)

```bash
# 1. Login to Railway
railway login

# 2. Initialize project (creates railway.json)
railway init

# 3. Link to existing project (if you already created one in the web UI)
# railway link <project-id>

# 4. Add Redis service
railway add redis

# 5. Set environment variables
railway variables set NODE_ENV=production
railway variables set DATABASE_URL=postgres://... # Your Neon database URL
railway variables set JWT_SECRET=your-secret-key
railway variables set PUBLIC_URL=https://your-app.up.railway.app
railway variables set FRONTEND_URL=https://your-app.up.railway.app
# ... set all other required variables (see .env.production)

# 6. Deploy
railway up
```

### Option 2: Railway Web UI

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect the Dockerfile
5. Add Redis service: "New" → "Database" → "Add Redis"
6. Set environment variables in the "Variables" tab
7. Deploy automatically happens on git push

## Environment Variables

Required environment variables (set in Railway dashboard):

```env
# Core
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://... # From Neon
REDIS_URL=${{Redis.REDIS_URL}} # Automatically set by Railway Redis service

# Public URL (IMPORTANT: Set this to your Railway domain)
PUBLIC_URL=https://your-app.up.railway.app
FRONTEND_URL=https://your-app.up.railway.app

# Security
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# API Keys
ARCJET_KEY=...
OPENAI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-app.up.railway.app/api/integrations/google/oauth-callback
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...
HUBSPOT_REDIRECT_URI_BASE=https://your-app.up.railway.app/api/integrations/hubspot

# Inngest
INNGEST_SIGNING_KEY=...
INNGEST_EVENT_KEY=...
INNGEST_APP_ID=...

# Twilio (if using)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
TWILIO_WEBHOOK_URL=https://your-app.up.railway.app/api/test-openai/twilio-webhook

# Email (if using)
ACCOUNT_EMAIL=...
EMAIL_PASSWORD=...

# Logging
LOG_LEVEL=info
```

## Important Notes

### 1. PUBLIC_URL vs Ngrok

- **Development**: Uses ngrok (if `NGROK_AUTH_TOKEN` is set)
- **Production**: Uses `PUBLIC_URL` environment variable
- **Railway**: Set `PUBLIC_URL` to your Railway domain (e.g., `https://your-app.up.railway.app`)

### 2. Database Migrations

Migrations run automatically on startup if needed. Alternatively, you can run them manually:

```bash
railway run npm run db:migrate
```

### 3. Custom Domain

To use a custom domain:

1. Go to Railway project → Settings → Domains
2. Add your custom domain
3. Update `PUBLIC_URL` and `FRONTEND_URL` to your custom domain
4. Update OAuth redirect URIs in Google/Hubspot to use your custom domain

### 4. Scaling

Railway automatically scales based on traffic. You can also set manual scaling:

```bash
railway scale --replicas 3
```

### 5. Monitoring

- View logs: `railway logs`
- View metrics: Railway dashboard → Metrics
- View deployments: Railway dashboard → Deployments

## Troubleshooting

### Application won't start

1. Check logs: `railway logs`
2. Verify all environment variables are set
3. Check database connection (verify `DATABASE_URL`)
4. Check Redis connection (verify `REDIS_URL`)

### Webhooks not working

1. Verify `PUBLIC_URL` is set correctly
2. Check that `PUBLIC_URL` is accessible (not localhost)
3. Verify OAuth redirect URIs match your `PUBLIC_URL`

### Database connection errors

1. Verify `DATABASE_URL` is correct
2. Check Neon database is accessible from Railway
3. Verify database migrations have run

## Railway vs Docker Compose

- **Docker Compose**: For self-hosted deployments (VPS, local development)
- **Railway**: For managed PaaS deployment (automatic scaling, SSL, monitoring)

Both use the same `Dockerfile`, but Railway handles:
- Automatic builds on git push
- SSL certificates
- Load balancing
- Health checks
- Auto-scaling

## Cost Estimation

Railway pricing (as of 2024):
- **Free Tier**: $5 credit/month (good for testing)
- **Hobby**: $5/month + usage
- **Pro**: $20/month + usage

Typical costs for this app:
- **Low traffic** (< 100 users): ~$10-15/month
- **Medium traffic** (100-1000 users): ~$30-50/month
- **High traffic** (> 1000 users): ~$100+/month

## Next Steps

After deployment:

1. Test all endpoints
2. Verify webhooks work
3. Test OAuth integrations
4. Monitor logs and metrics
5. Set up custom domain (optional)
6. Configure backups (Railway handles this automatically)

