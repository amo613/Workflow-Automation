CREATE TABLE "workflow_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"name" text,
	"description" text,
	"workflow_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_full_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."full_workflows"("id") ON DELETE cascade ON UPDATE no action;