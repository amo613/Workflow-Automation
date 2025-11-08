import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function fixMigrations() {
  try {
    console.log('🔍 Checking migration table...');

    // Check if migration table exists
    const migrationTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = '__drizzle_migrations'
      );
    `);

    if (!migrationTableExists.rows[0].exists) {
      console.log('❌ Migration table does not exist. Creating it...');
      await db.execute(sql`
        CREATE SCHEMA IF NOT EXISTS drizzle;
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        );
      `);
      console.log('✅ Migration table created.');
    }

    // Get existing migrations
    const existingMigrations = await db.execute(sql`
      SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at;
    `);

    console.log(
      '📋 Existing migrations:',
      existingMigrations.rows.map(r => r.hash)
    );

    // Check which tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'jobs', 'integrations', 'workflows')
      ORDER BY table_name;
    `);

    console.log(
      '📊 Existing tables:',
      tables.rows.map(r => r.table_name)
    );

    // Expected migrations based on journal.json
    const expectedMigrations = [
      '0000_powerful_raider',
      '0002_noisy_khan',
      '0003_awesome_randall_flagg',
    ];

    // Insert missing migrations
    for (const migration of expectedMigrations) {
      const exists = existingMigrations.rows.some(r => r.hash === migration);
      if (!exists) {
        console.log(`➕ Adding missing migration: ${migration}`);
        await db.execute(sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${migration}, ${Date.now()})
          ON CONFLICT DO NOTHING;
        `);
      } else {
        console.log(`✅ Migration already exists: ${migration}`);
      }
    }

    console.log('✅ Migration table synchronized!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixMigrations();
