import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load production environment
config({ path: join(__dirname, '..', '.env.production') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.production');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const migrationFiles = [
  '0000_powerful_raider.sql',
  '0002_noisy_khan.sql',
  '0003_awesome_randall_flagg.sql',
  '0003_worthless_goliath.sql',
  '0004_dazzling_kitty_pryde.sql',
  '0004_knowledge_base.sql',
  '0005_easy_owl.sql',
  '0005_full_workflows.sql',
  '0006_concerned_the_anarchist.sql',
  '0007_hesitant_justin_hammer.sql',
  '0008_cute_anthem.sql',
  '0009_shocking_kulan_gath.sql',
  '0010_workflow_versions.sql',
  '0011_remove_phone_number_from_twilio.sql',
  '0012_add_performance_indexes.sql',
];

async function runMigrations() {
  try {
    // Create __drizzle_migrations table if it doesn't exist
    await sql`CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
    console.log('✅ Migration tracking table ready');

    for (const file of migrationFiles) {
      const filePath = join(__dirname, '..', 'drizzle', file);
      
      try {
        const content = readFileSync(filePath, 'utf8');
        const hash = createHash('md5').update(content).digest('hex');

        // Check if migration already executed
        const existing = await sql`SELECT * FROM __drizzle_migrations WHERE hash = ${hash}`;
        if (existing.length > 0) {
          console.log(`✅ Skipping ${file} - already executed`);
          continue;
        }

        console.log(`📜 Executing ${file}...`);

        // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS
        // Also handle CREATE INDEX IF NOT EXISTS
        let modifiedContent = content
          .replace(/CREATE TABLE ("[^"]+")/g, 'CREATE TABLE IF NOT EXISTS $1')
          .replace(/CREATE INDEX ("[^"]+")/g, 'CREATE INDEX IF NOT EXISTS $1')
          .replace(/CREATE UNIQUE INDEX ("[^"]+")/g, 'CREATE UNIQUE INDEX IF NOT EXISTS $1');

        // Split by statement-breakpoint and execute each statement
        const statements = modifiedContent
          .split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await sql.unsafe(statement);
            } catch (error) {
              // If it's an "already exists" error, continue
              if (error.message && (
                error.message.includes('already exists') ||
                error.message.includes('duplicate key') ||
                error.code === '42P07' // relation already exists
              )) {
                console.log(`   ⚠️  Some objects already exist, continuing...`);
              } else {
                throw error;
              }
            }
          }
        }

        // Mark migration as executed
        await sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${hash}, ${Date.now()})`;
        console.log(`✅ ${file} executed successfully\n`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`⚠️  Skipping ${file} - file not found`);
          continue;
        }
        console.error(`❌ Error executing ${file}:`, error.message);
        throw error;
      }
    }

    console.log('✅ All migrations completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();

