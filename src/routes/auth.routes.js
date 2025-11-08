import express from 'express';
import { signIn, signOut, signUp } from '#controllers/auth.controller.js';

const router = express.Router();

router.post('/sign-up', signUp);
router.post('/sign-in', signIn);
router.post('/sign-out', signOut);

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
};

export default router;
