import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './user.model.js';

export const userTwilioCredentials = pgTable(
  'user_twilio_credentials',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encrypted_account_sid: text('encrypted_account_sid').notNull(),
    encrypted_auth_token: text('encrypted_auth_token').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index('idx_user_twilio_credentials_user_id').on(table.user_id),
  })
);
