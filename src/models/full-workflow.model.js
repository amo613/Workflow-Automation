import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './user.model.js';

// Enum for workflow type
export const workflowTypeEnum = pgEnum('workflow_type', [
  'automation',
  'call-workflow',
]);

export const fullWorkflows = pgTable('full_workflows', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Workflow metadata
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Workflow type
  type: workflowTypeEnum('type').notNull().default('automation'),

  // Workflow graph (React Flow JSON structure)
  workflow_json: jsonb('workflow_json').notNull(),

  // Status
  is_active: boolean('is_active').default(false),

  // Timestamps
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
