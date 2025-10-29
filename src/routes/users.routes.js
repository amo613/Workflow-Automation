import express from 'express';
import {
  fetchAllUsers,
  fetchUserById,
  updateUserById,
  deleteUserById,
} from '#controllers/users.controller.js';
import { authenticateToken, requireRole } from '#middleware/auth.middleware.js';
import { userRoutesCache, invalidateUserCache } from '#utils/cache.utils.js';
import { invalidateCache } from '#middleware/cache.middleware.js';

const router = express.Router();

// GET /api/users
router.get('/', 
  authenticateToken, 
  requireRole(['admin']), 
  userRoutesCache(),
  fetchAllUsers
);

// GET /api/users/:id
router.get('/:id', 
  authenticateToken, 
  userRoutesCache(),
  fetchUserById
);

// PUT /api/users/:id
router.put('/:id', 
  authenticateToken, 
  invalidateCache({
    patterns: [
      'users:*',
      'user:*',
      '*:users:*',
    ],
    tags: ['users'],
  }),
  updateUserById
);

// DELETE /api/users/:id - Delete user (invalidates cache)
router.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  invalidateCache({
    // This will be called after successful response
    patterns: [
      'users:*',
      'user:*',
      '*:users:*',
    ],
    tags: ['users'],
  }),
  deleteUserById
);

export default router;
