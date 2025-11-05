import {
  pgTable,
  serial,
  varchar,
  timestamp,
  text,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from './user.model.js';

export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Integration Type
  integration_type: varchar('integration_type', { length: 50 }).notNull(), // 'GOOGLE_CALENDAR'

  // OAuth Tokens
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token'),
  token_expires_at: timestamp('token_expires_at'),

  // Google Calendar specific config
  email: varchar('email', { length: 255 }), // Google Account Email
  timezone: varchar('timezone', { length: 100 }), // e.g., 'Europe/Berlin'
  calendar_id: varchar('calendar_id', { length: 255 }).default('primary'),

  // Settings
  mode: varchar('mode', { length: 50 }), // 'MEETING_SCHEDULER' | 'PERSONAL_ASSISTANT'
  minimum_notice_hours: integer('minimum_notice_hours'),
  maximum_days_advance: integer('maximum_days_advance'),
  maximum_duration_hours: integer('maximum_duration_hours'),

  // Status
  is_active: boolean('is_active').default(true),
  is_complete: boolean('is_complete').default(false),

  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
