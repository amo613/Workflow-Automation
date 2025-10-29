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

export const fetchAllUsers = async (req, res, next) => {
  try {
    logger.info('Getting all users');
    const allUsers = await getAllUsers();

    res.json({
      message: 'Successfully retrieved all users',
      users: allUsers,
      count: allUsers.length,
    });
  } catch (e) {
    logger.error('Error getting users', e);
    next(e);
  }
};

export const fetchUserById = async (req, res, next) => {
  try {
    // Validate user ID from params
    const validationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;
    logger.info(`Getting user by id: ${id}`);

    const user = await getUserById(id);

    res.json({
      message: 'Successfully retrieved user',
      user,
    });
  } catch (e) {
    logger.error(`Error getting user by id ${req.params.id}:`, e);

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(e);
  }
};

export const updateUserById = async (req, res, next) => {
  try {
    const idValidation = userIdSchema.safeParse({ id: req.params.id });

    if (!idValidation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(idValidation.error),
      });
    }

    const bodyValidation = updateUserSchema.safeParse(req.body);

    if (!bodyValidation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(bodyValidation.error),
      });
    }

    const { id } = idValidation.data;
    const updates = bodyValidation.data;

    logger.info(`Updating user ${id}`);

    const updatedUser = await updateUser(id, updates);

    res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (e) {
    logger.error(`Error updating user ${req.params.id}:`, e);

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    if (e.message === 'Email already exists') {
      return res.status(409).json({ error: 'Email already exists' });
    }

    next(e);
  }
};

export const deleteUserById = async (req, res, next) => {
  try {
    // Validate user ID from params
    const validationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;
    logger.info(`Deleting user ${id}`);

    const deletedUser = await deleteUser(id);

    res.json({
      message: 'User deleted successfully',
      user: deletedUser,
    });
  } catch (e) {
    logger.error(`Error deleting user ${req.params.id}:`, e);

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(e);
  }
};
