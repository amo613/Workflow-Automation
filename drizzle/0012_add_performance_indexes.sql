-- Add performance indexes for frequently queried tables
-- This migration adds indexes to improve query performance for:
-- 1. Full workflows queries by user_id and is_active
-- 2. Jobs queries by user_id and status
-- 3. Workflow versions queries

-- Indexes for full_workflows table
CREATE INDEX IF NOT EXISTS "idx_full_workflows_user_id" ON "full_workflows"("user_id");
CREATE INDEX IF NOT EXISTS "idx_full_workflows_is_active" ON "full_workflows"("is_active");
CREATE INDEX IF NOT EXISTS "idx_full_workflows_created_at" ON "full_workflows"("created_at" DESC);
-- Composite index for common query pattern: get active workflows for user, ordered by creation date
CREATE INDEX IF NOT EXISTS "idx_full_workflows_user_active_created" ON "full_workflows"("user_id", "is_active", "created_at" DESC);

-- Indexes for jobs table (if not already exists)
CREATE INDEX IF NOT EXISTS "idx_jobs_user_id" ON "jobs"("user_id");
-- Composite index for common query pattern: get jobs for user by status, ordered by creation date
CREATE INDEX IF NOT EXISTS "idx_jobs_user_status_created" ON "jobs"("user_id", "status", "created_at" DESC);

-- Indexes for workflow_versions table (if exists)
CREATE INDEX IF NOT EXISTS "idx_workflow_versions_workflow_id" ON "workflow_versions"("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_versions_created_at" ON "workflow_versions"("created_at" DESC);
-- Composite index for getting latest version of a workflow
CREATE INDEX IF NOT EXISTS "idx_workflow_versions_workflow_created" ON "workflow_versions"("workflow_id", "created_at" DESC);

