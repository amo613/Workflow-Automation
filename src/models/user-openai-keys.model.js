import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './user.model.js';

export const userOpenAiKeys = pgTable(
  'user_openai_keys',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encrypted_api_key: text('encrypted_api_key').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index('idx_user_openai_keys_user_id').on(table.user_id),
  })
);
