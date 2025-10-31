import 'dotenv/config';

import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { NODE_ENV, DATABASE_URL } from '#config/env.js';

if (NODE_ENV === 'development') {
  neonConfig.fetchEndpoint = 'http://neon-local:5432/sql';
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
} else if (NODE_ENV === 'production' && DATABASE_URL?.includes('-pooler.')) {
  // Production with Pooler URL - use HTTP fetch
  neonConfig.poolQueryViaFetch = true;
  neonConfig.useSecureWebSocket = false;
}

const sql = neon(
  NODE_ENV === 'production'
    ? DATABASE_URL
    : 'postgres://neon:npg@neon-local:5432/neondb'
);

const db = drizzle(sql);

export { db, sql };
