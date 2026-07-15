
# Base image with Node.js
# Node 24 is the current LTS release; Node 20 reached end of life in March 2026.
FROM node:24-alpine AS base

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for UI build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build React UI (needs dev dependencies), then remove its build-only packages.
RUN npm run ui:build && rm -rf ui/node_modules

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Winston writes optional file logs in addition to stdout.
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app
USER nodejs

# Expose the port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3001) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Development stage
FROM base AS development
USER root
RUN npm ci && npm cache clean --force
USER nodejs
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
ENV NODE_ENV=production
# Remove dev dependencies after build
RUN npm prune --omit=dev && npm cache clean --force
CMD ["npm", "start"]
