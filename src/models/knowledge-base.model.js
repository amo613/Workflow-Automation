import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './user.model.js';

// Note: pgvector support requires custom SQL migration
// The embedding column will be added via raw SQL as vector(1536)
export const knowledgeBaseEntries = pgTable(
  'knowledge_base_entries',
  {
    id: serial('id').primaryKey(),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    text: text('text').notNull(),
    // embedding will be added via raw SQL as vector(1536)
    // embedding: customType({ dataType: 'vector(1536)' })(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    userIdIdx: index('idx_kb_user_id').on(table.user_id),
    nameIdx: index('idx_kb_name').on(table.name),
  })
);
