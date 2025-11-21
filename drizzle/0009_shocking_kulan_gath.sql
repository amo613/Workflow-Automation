CREATE TABLE "user_email_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"encrypted_smtp_host" text NOT NULL,
	"encrypted_smtp_port" text NOT NULL,
	"encrypted_smtp_user" text NOT NULL,
	"encrypted_smtp_password" text NOT NULL,
	"encrypted_from_email" text NOT NULL,
	"encrypted_from_name" text,
	"use_tls" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_email_credentials" ADD CONSTRAINT "user_email_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_email_credentials_user_id" ON "user_email_credentials" USING btree ("user_id");