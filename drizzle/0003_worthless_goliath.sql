CREATE TABLE "user_twilio_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"encrypted_account_sid" text NOT NULL,
	"encrypted_auth_token" text NOT NULL,
	"encrypted_phone_number" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_twilio_credentials" ADD CONSTRAINT "user_twilio_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_twilio_credentials_user_id" ON "user_twilio_credentials" USING btree ("user_id");