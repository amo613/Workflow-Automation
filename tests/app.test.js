import fastifyApp from '#src/fastify-app.js';
import request from 'supertest';
import { closeRedis } from '#config/cache.js';
import { closeLogger } from '#config/logger.js';

describe('API ENDPOINTS', () => {
  // Close all connections after tests to prevent Jest from hanging
  afterAll(async () => {
    await fastifyApp.close();
    await closeRedis();
    await closeLogger();
    // Wait a bit for all connections to close properly
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  // Ensure Fastify is ready before tests
  beforeAll(async () => {
    await fastifyApp.ready();
  });

  describe('GET /health', () => {
    it('should return health stats', async () => {
      const response = await request(fastifyApp.server)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api', () => {
    it('should return API stats', async () => {
      const response = await request(fastifyApp.server).get('/api').expect(200);

      expect(response.body).toHaveProperty('message', 'API is running!');
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for non-existing routes', async () => {
      const response = await request(fastifyApp.server)
        .get('/nonexisting')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });
});
