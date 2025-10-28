# GitHub Actions Workflows

This repository includes three CI/CD workflows for automated testing, linting, and Docker builds.

## Workflows

### 1. Lint and Format (`lint-and-format.yml`)

**Triggers:**

- Push to `main` or `staging` branches
- Pull requests to `main` or `staging` branches

**What it does:**

- Runs ESLint with `npm run lint`
- Runs Prettier check with `npm run format:check`
- Provides clear annotations suggesting fixes with `npm run lint:fix` and `npm run format`
- Fails the workflow if issues are found

### 2. Tests (`tests.yml`)

**Triggers:**

- Push to `main` or `staging` branches
- Pull requests to `main` or `staging` branches

**What it does:**

- Runs test suite with `npm test`
- Sets environment variables: `NODE_ENV=test`, `NODE_OPTIONS=--experimental-vm-modules`
- Uploads coverage reports as artifacts (retention: 30 days)
- Generates GitHub step summary with test results and coverage status
- Annotates test failures

### 3. Docker Build and Push (`docker-build-and-push.yml`)

**Triggers:**

- Push to `main` branch
- Manual trigger via `workflow_dispatch`

**What it does:**

- Sets up Docker Buildx for multi-platform builds
- Logs in to Docker Hub using secrets
- Extracts metadata including:
  - Branch name
  - Commit SHA (as `{branch}-{sha}`)
  - `latest` tag (on main branch)
  - Production timestamp tag (`prod-YYYYMMDD-HHmmss`)
- Builds and pushes image for `linux/amd64` and `linux/arm64`
- Uses GitHub Actions cache for efficient builds
- Generates summary with published image name and tags

## Required Secrets

Add these secrets in your GitHub repository settings:

1. **For Docker Build:**
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub password or access token

2. **For Tests (optional):**
   - `DATABASE_URL`: Test database connection string (falls back to default if not set)

## Usage

### Running workflows manually

```bash
# From GitHub UI: Actions → Select workflow → "Run workflow"
```

### Local testing

```bash
# Test linting
npm run lint
npm run lint:fix

# Test formatting
npm run format:check
npm run format

# Test tests
npm test
```

## Workflow Status

Check workflow status in the GitHub Actions tab or via the badges:

- [![Lint](https://github.com/USERNAME/REPO/workflows/Lint/badge.svg)](https://github.com/USERNAME/REPO/actions)
- [![Tests](https://github.com/USERNAME/REPO/workflows/Tests/badge.svg)](https://github.com/USERNAME/REPO/actions)
- [![Docker Build](https://github.com/USERNAME/REPO/workflows/Docker/badge.svg)](https://github.com/USERNAME/REPO/actions)
