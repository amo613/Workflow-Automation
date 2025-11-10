-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_base_entries table
CREATE TABLE "knowledge_base_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD CONSTRAINT "knowledge_base_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_kb_user_id" ON "knowledge_base_entries"("user_id");
--> statement-breakpoint
CREATE INDEX "idx_kb_name" ON "knowledge_base_entries"("name");
--> statement-breakpoint
-- Create HNSW index for vector similarity search (better performance than IVFFlat)
CREATE INDEX "idx_kb_embedding_hnsw" ON "knowledge_base_entries" 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

