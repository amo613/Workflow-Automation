import express from 'express';
import {
  signIn,
  signOut,
  signUp,
  getCurrentUser,
} from '#controllers/auth.controller.js';
import { authenticateToken } from '#middleware/auth.middleware.js';
import { authenticateTokenFastify } from '#middleware/auth.middleware.js';

const router = express.Router();

router.post('/sign-up', signUp);
router.post('/sign-in', signIn);
router.post('/sign-out', signOut);
router.get('/me', authenticateToken, getCurrentUser);

// Fastify plugin function
export const authRoutesFastify = async fastify => {
  fastify.post('/sign-up', async (request, reply) => {
    return signUp(request, reply);
  });

  fastify.post('/sign-in', async (request, reply) => {
    return signIn(request, reply);
  });

  fastify.post('/sign-out', async (request, reply) => {
    return signOut(request, reply);
  });

  fastify.get(
    '/me',
    { preHandler: [authenticateTokenFastify] },
    async (request, reply) => {
      return getCurrentUser(request, reply);
    }
  );
};

export default router;
