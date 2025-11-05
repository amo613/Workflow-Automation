CREATE TABLE "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"integration_type" varchar(50) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"email" varchar(255),
	"timezone" varchar(100),
	"calendar_id" varchar(255) DEFAULT 'primary',
	"mode" varchar(50),
	"minimum_notice_hours" integer,
	"maximum_days_advance" integer,
	"maximum_duration_hours" integer,
	"is_active" boolean DEFAULT true,
	"is_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"queue" varchar(64) DEFAULT 'jobs' NOT NULL,
	"type" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL,
	"priority" integer,
	"attempts_made" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"user_id" integer,
	"data" jsonb NOT NULL,
	"result" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_type_created" ON "jobs" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_created_at" ON "jobs" USING btree ("created_at");