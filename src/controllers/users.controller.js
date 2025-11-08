import logger from '#config/logger.js';
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '#services/users.service.js';
import {
  userIdSchema,
  updateUserSchema,
} from '#validations/users.validation.js';
import { formatValidationError } from '#utils/format.js';

// Helper: Detect if this is Fastify (has reply) or Express (has res)
const isFastify = reply =>
  reply &&
  typeof reply.send === 'function' &&
  typeof reply.status === 'function';

export const fetchAllUsers = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    logger.info('Getting all users');
    const allUsers = await getAllUsers();

    if (isFastifyRequest) {
      return reply.status(200).send({
        message: 'Successfully retrieved all users',
        users: allUsers,
        count: allUsers.length,
      });
    }
    res.json({
      message: 'Successfully retrieved all users',
      users: allUsers,
      count: allUsers.length,
    });
  } catch (e) {
    logger.error('Error getting users', e);
    if (isFastifyRequest) {
      throw e;
    }
    next(e);
  }
};

export const fetchUserById = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    // Validate user ID from params
    const validationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(validationResult.error),
        });
      }
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;
    logger.info(`Getting user by id: ${id}`);

    const user = await getUserById(id);

    if (isFastifyRequest) {
      return reply.status(200).send({
        message: 'Successfully retrieved user',
        user,
      });
    }
    res.json({
      message: 'Successfully retrieved user',
      user,
    });
  } catch (e) {
    logger.error(`Error getting user by id ${req.params.id}:`, e);

    if (e.message === 'User not found') {
      if (isFastifyRequest) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    if (isFastifyRequest) {
      throw e;
    }
    next(e);
  }
};

export const updateUserById = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const idValidation = userIdSchema.safeParse({ id: req.params.id });

    if (!idValidation.success) {
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(idValidation.error),
        });
      }
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(idValidation.error),
      });
    }

    const bodyValidation = updateUserSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(bodyValidation.error),
        });
      }
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(bodyValidation.error),
      });
    }

    const { id } = idValidation.data;
    const updates = bodyValidation.data;

    logger.info(`Updating user ${id}`);

    const updatedUser = await updateUser(id, updates);

    if (isFastifyRequest) {
      return reply.status(200).send({
        message: 'User updated successfully',
        user: updatedUser,
      });
    }
    res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (e) {
    logger.error(`Error updating user ${req.params.id}:`, e);

    if (e.message === 'User not found') {
      if (isFastifyRequest) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    if (e.message === 'Email already exists') {
      if (isFastifyRequest) {
        return reply.status(409).send({ error: 'Email already exists' });
      }
      return res.status(409).json({ error: 'Email already exists' });
    }

    if (isFastifyRequest) {
      throw e;
    }
    next(e);
  }
};

export const deleteUserById = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    // Validate user ID from params
    const validationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(validationResult.error),
        });
      }
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;
    logger.info(`Deleting user ${id}`);

    const deletedUser = await deleteUser(id);

    if (isFastifyRequest) {
      return reply.status(200).send({
        message: 'User deleted successfully',
        user: deletedUser,
      });
    }
    res.json({
      message: 'User deleted successfully',
      user: deletedUser,
    });
  } catch (e) {
    logger.error(`Error deleting user ${req.params.id}:`, e);

    if (e.message === 'User not found') {
      if (isFastifyRequest) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return res.status(404).json({ error: 'User not found' });
    }

    if (isFastifyRequest) {
      throw e;
    }
    next(e);
  }
};
