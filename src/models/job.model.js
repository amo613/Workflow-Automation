import {
  pgTable,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// NOTE: Using deprecated pgTable syntax for indexes as it's the only working way in Drizzle v0.44.7
// The new syntax with separate index definitions causes JSON parsing errors
export const jobs = pgTable(
  'jobs',
  {
    id: varchar('id', { length: 64 }).primaryKey(), // BullMQ jobId
    queue: varchar('queue', { length: 64 }).notNull().default('jobs'),
    type: varchar('type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    priority: integer('priority'),
    attemptsMade: integer('attempts_made').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(1),
    userId: integer('user_id'),
    data: jsonb('data').notNull(),
    result: jsonb('result'),
    error: jsonb('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    statusIdx: index('idx_jobs_status').on(table.status),
    typeCreatedIdx: index('idx_jobs_type_created').on(
      table.type,
      table.createdAt
    ),
    createdAtIdx: index('idx_jobs_created_at').on(table.createdAt),
  })
);
