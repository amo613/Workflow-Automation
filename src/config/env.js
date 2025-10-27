import { config } from 'dotenv';

config({path: `.env`});

export const {
    PORT, NODE_ENV,
    DATABASE_URL,
    JWT_SECRET, JWT_EXPIRES_IN,
    ARCJET_KEY,
    LOG_LEVEL
} = process.env;

/*
* # Server settings

PORT=3001
NODE_ENV=development
LOG_LEVEL=info

#DATAbase Configuration
DATABASE_URL=postgresql://neondb_owner:npg_enRrf8hG6cZw@ep-old-base-agqci3y3-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# JWT
JWT_SECRET=secret
JWT_EXPIRES_IN=1d

# Arcjet

ARCJET_KEY=ajkey_01k8jkksgnehw8aq1nz7e1e46q
* */