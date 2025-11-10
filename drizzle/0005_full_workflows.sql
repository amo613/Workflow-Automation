CREATE TYPE "public"."workflow_type" AS ENUM('automation', 'call-workflow');--> statement-breakpoint
CREATE TABLE "full_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "workflow_type" DEFAULT 'automation' NOT NULL,
	"workflow_json" jsonb NOT NULL,
	"is_active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "full_workflows" ADD CONSTRAINT "full_workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;