/**
 * Apply the idempotent HubSpot OAuth 2026 migration.
 *
 * Run locally or as a Railway one-off command with DATABASE_URL configured:
 * npm run db:migrate:hubspot
 */
import pg from 'pg';

const migrationSql = `
ALTER TABLE "integrations"
  ADD COLUMN IF NOT EXISTS "external_account_id" varchar(100);

ALTER TABLE "integrations"
  ADD COLUMN IF NOT EXISTS "granted_scopes" text;

CREATE INDEX IF NOT EXISTS "idx_integrations_hubspot_account"
  ON "integrations" ("integration_type", "external_account_id")
  WHERE "is_active" = true;
`;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(migrationSql);
    console.log('HubSpot OAuth migration (0014) applied successfully.');
  } catch (error) {
    console.error('HubSpot migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
