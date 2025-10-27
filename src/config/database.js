import 'dotenv/config';

import {neon, neonConfig} from '@neondatabase/serverless';
import {drizzle} from 'drizzle-orm/neon-http';
import {DATABASE_URL} from "#config/env.js";

const sql = neon(DATABASE_URL);

const db = drizzle(sql);

export {db,sql};
