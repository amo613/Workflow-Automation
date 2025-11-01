import app from '#src/app.js';
import request from 'supertest';
import { closeRedis } from '#config/cache.js';
import { closeLogger } from '#config/logger.js';

describe('API ENDPOINTS', () => {
  // Close all connections after tests to prevent Jest from hanging
  afterAll(async () => {
    await closeRedis();
    await closeLogger();
    // Wait a bit for all connections to close properly
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  describe('GET /health', () => {
    it('should return health stats', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api', () => {
    it('should return API stats', async () => {
      const response = await request(app).get('/api').expect(200);

      expect(response.body).toHaveProperty('message', 'API is running!');
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for non-existing routes', async () => {
      const response = await request(app).get('/nonexisting').expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });
});
