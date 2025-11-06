import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  integer,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './user.model.js';

export const workflows = pgTable('workflows', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Workflow metadata
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  // Workflow graph (React Flow JSON structure)
  graph_json: jsonb('graph_json').notNull(),

  // Status
  is_active: boolean('is_active').default(false),

  // Timestamps
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
