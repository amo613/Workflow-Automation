/**
 * Run only the workflow-agents migration (0013).
 * Use when production DB already has older migrations applied and full "drizzle-kit migrate" would fail.
 *
 * Run once: node scripts/run-agents-migration.js
 * Or on Railway: add a one-off job / run in shell with DATABASE_URL set.
 */
import pg from 'pg';

const sql = `
-- Add agent-related columns to full_workflows
ALTER TABLE "full_workflows" ADD COLUMN IF NOT EXISTS "goal_definition" jsonb;
ALTER TABLE "full_workflows" ADD COLUMN IF NOT EXISTS "agents_enabled" boolean DEFAULT false;

-- Create workflow_agent_actions table
CREATE TABLE IF NOT EXISTS "workflow_agent_actions" (
  "id" serial PRIMARY KEY NOT NULL,
  "workflow_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "agent_type" text NOT NULL,
  "action_type" text NOT NULL,
  "details" jsonb,
  "optimization_impact" text,
  "workflow_version_id" integer
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_agent_actions_workflow_id_full_workflows_id_fk') THEN
    ALTER TABLE "workflow_agent_actions" ADD CONSTRAINT "workflow_agent_actions_workflow_id_full_workflows_id_fk"
      FOREIGN KEY ("workflow_id") REFERENCES "public"."full_workflows"("id") ON DELETE cascade ON UPDATE no action;
  END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workflow_agent_actions_workflow_version_id_workflow_versions_id_fk') THEN
    ALTER TABLE "workflow_agent_actions" ADD CONSTRAINT "workflow_agent_actions_workflow_version_id_workflow_versions_id_fk"
      FOREIGN KEY ("workflow_version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE set null ON UPDATE no action;
  END IF; END $$;

CREATE INDEX IF NOT EXISTS "idx_workflow_agent_actions_workflow_id" ON "workflow_agent_actions"("workflow_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_agent_actions_created_at" ON "workflow_agent_actions"("created_at" DESC);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Agents migration (0013) applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
