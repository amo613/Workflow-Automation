import { config } from 'dotenv';

const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
config({ path: envFile });

export const {
  PORT,
  NODE_ENV,
  DATABASE_URL,
  DATABASE_NAME,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ARCJET_KEY,
  LOG_LEVEL,
  NEON_API_KEY,
  NEON_PROJECT_ID,
  PARENT_BRANCH_ID,
  DELETE_BRANCH,
} = process.env;
