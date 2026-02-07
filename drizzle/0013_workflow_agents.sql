-- Add agent-related columns to full_workflows
ALTER TABLE "full_workflows" ADD COLUMN IF NOT EXISTS "goal_definition" jsonb;
ALTER TABLE "full_workflows" ADD COLUMN IF NOT EXISTS "agents_enabled" boolean DEFAULT false;

-- Create workflow_agent_actions table for explainable AI / documenting LLM actions
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

--> statement-breakpoint
ALTER TABLE "workflow_agent_actions" ADD CONSTRAINT "workflow_agent_actions_workflow_id_full_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."full_workflows"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workflow_agent_actions" ADD CONSTRAINT "workflow_agent_actions_workflow_version_id_workflow_versions_id_fk" FOREIGN KEY ("workflow_version_id") REFERENCES "public"."workflow_versions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_agent_actions_workflow_id" ON "workflow_agent_actions"("workflow_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_agent_actions_created_at" ON "workflow_agent_actions"("created_at" DESC);
