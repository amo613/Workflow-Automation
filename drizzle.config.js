import 'dotenv/config';
import { DATABASE_URL } from '#config/env.js';

export default {
  schema: './src/models/*.js',
  out: 'drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
};
