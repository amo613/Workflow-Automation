import 'dotenv/config';

import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

if (process.env.NODE_ENV === 'development') {
  neonConfig.fetchEndpoint = 'http://neon-local:5432/sql';
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
} else if (process.env.NODE_ENV === 'production') {
  neonConfig.fetchEndpoint = process.env.DATABASE_URL;
  neonConfig.useSecureWebSocket = true;
  neonConfig.poolQueryViaFetch = false;
}

const sql = neon(
  process.env.NODE_ENV === 'production'
    ? process.env.production.DATABASE_URL
    : 'postgres://neon:npg@localhost:5432/neondb?sslmode=require'
);

const db = drizzle(sql);

export { db, sql };
