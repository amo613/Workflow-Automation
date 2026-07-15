import fastifyApp from '#src/fastify-app.js';
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
      const response = await fastifyApp.inject({
        method: 'GET',
        url: '/health',
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body).toHaveProperty('status', 'OK');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
    });
  });

  describe('GET /api', () => {
    it('should return API stats', async () => {
      const response = await fastifyApp.inject({ method: 'GET', url: '/api' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty('message', 'API is running!');
    });
  });

  describe('GET /favicon.png', () => {
    it('should serve the production favicon', async () => {
      const response = await fastifyApp.inject({
        method: 'GET',
        url: '/favicon.png',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.rawPayload.length).toBeGreaterThan(0);
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for non-existing API routes', async () => {
      const response = await fastifyApp.inject({
        method: 'GET',
        url: '/api/nonexisting',
      });
      const body = response.json();

      // Check that we got a 404 status
      expect(response.statusCode).toBe(404);
      // If response body has error field, it should match expected message
      if (body && typeof body === 'object' && body.error) {
        expect(body.error).toBe('Route not found');
      }
    });
  });
});
