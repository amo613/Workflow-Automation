import http from 'http';
import https from 'https';
import { Agent as UndiciAgent } from 'undici';

/**
 * HTTP/HTTPS agents with connection pooling
 * Keep connections alive for better performance
 * 
 * Note: Node.js native fetch uses undici internally.
 * For fetch() calls, use undiciAgent instead of http/https agents.
 */
export const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

export const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
});

/**
 * Undici dispatcher for native Node.js fetch()
 * Supports connection pooling for fetch API
 */
export const undiciAgent = new UndiciAgent({
  keepAliveTimeout: 30000,
  keepAliveMaxTimeout: 60000,
  connections: 50,
  pipelining: 1,
});
