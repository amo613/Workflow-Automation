import {
  fetchAllUsers,
  fetchUserById,
  updateUserById,
  deleteUserById,
} from '#controllers/users.controller.js';
import { userRoutesCache, cacheMiddlewareFastify } from '#utils/cache.utils.js';
import { invalidateCache } from '#middleware/cache.middleware.js';
import {
  authenticateTokenFastify,
  requireRoleFastify,
} from '#middleware/auth.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';

// Fastify plugin function with request timing and caching
export const userRoutesFastify = async fastify => {
  // Request timing hooks
  const timingHooks = requestTimingHooks('User');
  fastify.addHook('onRequest', timingHooks.onRequest);
  fastify.addHook('onResponse', timingHooks.onResponse);

  // Cache middleware wrapper
  const userCacheFastify = cacheMiddlewareFastify(userRoutesCache);

  // GET /api/users - Get all users (admin only, with caching)
  fastify.get(
    '/',
    {
      preHandler: [
        authenticateTokenFastify,
        requireRoleFastify(['admin']),
        userCacheFastify,
      ],
    },
    async (request, reply) => {
      return fetchAllUsers(request, reply);
    }
  );

  // GET /api/users/:id - Get user by ID (with caching)
  fastify.get(
    '/:id',
    {
      preHandler: [authenticateTokenFastify, userCacheFastify],
    },
    async (request, reply) => {
      return fetchUserById(request, reply);
    }
  );

  // PUT /api/users/:id - Update user (invalidates cache)
  fastify.put(
    '/:id',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      const result = await updateUserById(request, reply);
      // Invalidate user cache after update
      await invalidateCache({
        patterns: ['users:*', 'user:*', '*:users:*'],
        tags: ['users'],
      })(request, reply, () => {});
      return result;
    }
  );

  // DELETE /api/users/:id - Delete user (admin only, invalidates cache)
  fastify.delete(
    '/:id',
    {
      preHandler: [authenticateTokenFastify, requireRoleFastify(['admin'])],
    },
    async (request, reply) => {
      const result = await deleteUserById(request, reply);
      // Invalidate user cache after deletion
      await invalidateCache({
        patterns: ['users:*', 'user:*', '*:users:*'],
        tags: ['users'],
      })(request, reply, () => {});
      return result;
    }
  );
};
