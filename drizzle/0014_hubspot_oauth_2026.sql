ALTER TABLE "integrations"
  ADD COLUMN IF NOT EXISTS "external_account_id" varchar(100);

ALTER TABLE "integrations"
  ADD COLUMN IF NOT EXISTS "granted_scopes" text;

CREATE INDEX IF NOT EXISTS "idx_integrations_hubspot_account"
  ON "integrations" ("integration_type", "external_account_id")
  WHERE "is_active" = true;
