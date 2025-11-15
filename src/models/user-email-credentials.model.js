import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './user.model.js';

export const userEmailCredentials = pgTable(
  'user_email_credentials',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    encrypted_smtp_host: text('encrypted_smtp_host').notNull(),
    encrypted_smtp_port: text('encrypted_smtp_port').notNull(),
    encrypted_smtp_user: text('encrypted_smtp_user').notNull(),
    encrypted_smtp_password: text('encrypted_smtp_password').notNull(),
    encrypted_from_email: text('encrypted_from_email').notNull(),
    encrypted_from_name: text('encrypted_from_name'),
    use_tls: integer('use_tls').default(1).notNull(), // 0 = false, 1 = true
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index('idx_user_email_credentials_user_id').on(table.user_id),
  })
);
