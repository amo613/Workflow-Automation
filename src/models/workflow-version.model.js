import {
  pgTable,
  serial,
  integer,
  timestamp,
  jsonb,
  text,
} from 'drizzle-orm/pg-core';
import { fullWorkflows } from './full-workflow.model.js';

export const workflowVersions = pgTable('workflow_versions', {
  id: serial('id').primaryKey(),
  workflow_id: integer('workflow_id')
    .notNull()
    .references(() => fullWorkflows.id, { onDelete: 'cascade' }),

  // Version metadata
  version_number: integer('version_number').notNull(),
  name: text('name'), // Optional: user-defined version name
  description: text('description'), // Optional: what changed in this version

  // Snapshot of the workflow at this version
  workflow_json: jsonb('workflow_json').notNull(),

  // Timestamps
  created_at: timestamp('created_at').defaultNow().notNull(),
  created_by: integer('created_by'), // User ID who created this version (optional)
});
