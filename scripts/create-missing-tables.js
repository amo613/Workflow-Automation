import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function createMissingTables() {
  try {
    console.log('🔍 Checking for missing tables...');

    // Check if integrations table exists
    const integrationsExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'integrations'
      );
    `);

    if (!integrationsExists.rows[0].exists) {
      console.log('➕ Creating integrations table...');
      await db.execute(sql`
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
      `);
      await db.execute(sql`
        ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      `);
      console.log('✅ integrations table created!');
    } else {
      console.log('✅ integrations table already exists');
    }

    // Check if workflows table exists
    const workflowsExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'workflows'
      );
    `);

    if (!workflowsExists.rows[0].exists) {
      console.log('➕ Creating workflows table...');
      await db.execute(sql`
        CREATE TABLE "workflows" (
          "id" serial PRIMARY KEY NOT NULL,
          "user_id" integer NOT NULL,
          "name" varchar(255) NOT NULL,
          "description" text,
          "graph_json" jsonb NOT NULL,
          "is_active" boolean DEFAULT false,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
      `);
      await db.execute(sql`
        ALTER TABLE "workflows" ADD CONSTRAINT "workflows_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
      `);
      console.log('✅ workflows table created!');
    } else {
      console.log('✅ workflows table already exists');
    }

    console.log('✅ All tables created!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createMissingTables();
