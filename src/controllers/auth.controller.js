import logger from '#config/logger.js';
import { signUpSchema, signInSchema } from '#validations/auth.validation.js';
import { formatValidationError } from '#utils/format.js';
import { createUser, authenticateUser } from '#services/auth.service.js';
import { jwttoken } from '#utils/jwt.js';
import { cookies } from '#utils/cookies.js';
import { cookiesFastify } from '#utils/cookies-fastify.js';

// Helper: Detect if this is Fastify (has reply) or Express (has res)
const isFastify = reply => reply && typeof reply.setCookie === 'function';

export const signUp = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    const validationResult = signUpSchema.safeParse(req.body);

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

    const { name, email, password, role } = validationResult.data;

    const user = await createUser({ name, email, password, role });

    const token = jwttoken.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Use appropriate cookie utility
    if (isFastifyRequest) {
      cookiesFastify.set(reply, 'token', token);
    } else {
      cookies.set(res, 'token', token);
    }

    logger.info(`User registered successfully: ${email}`);

    const redirectTo = req.query?.redirectTo;
    const accept = req.headers['accept'] || '';

    // Handle redirect for HTML requests (similar to signIn)
    if (
      redirectTo ||
      (typeof accept === 'string' && accept.includes('text/html'))
    ) {
      const redirectUrl = redirectTo || '/api/test-openai';
      if (isFastifyRequest) {
        return reply.redirect(302, redirectUrl);
      }
      return res.redirect(302, redirectUrl);
    }

    const response = {
      message: 'User registered',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    if (isFastifyRequest) {
      return reply.status(201).send(response);
    }
    return res.status(201).json(response);
  } catch (e) {
    logger.error('Signup error', e);

    const accept = req.headers['accept'] || '';
    const isHtmlRequest =
      typeof accept === 'string' && accept.includes('text/html');
    const redirectTo = req.query?.redirectTo;

    if (e.message === 'User with this email already exists') {
      if (isHtmlRequest && redirectTo) {
        // For HTML requests with redirect, redirect back to register page with error
        if (isFastifyRequest) {
          return reply.redirect(
            302,
            `/register?error=${encodeURIComponent('Email already exists')}`
          );
        }
        return res.redirect(
          302,
          `/register?error=${encodeURIComponent('Email already exists')}`
        );
      }
      if (isFastifyRequest) {
        return reply.status(409).send({ error: 'Email already exist' });
      }
      return res.status(409).json({ error: 'Email already exist' });
    }

    // Error handling
    if (isFastifyRequest) {
      throw e; // Fastify handles errors via error handler
    }
    next(e); // Express uses next()
  }
};

export const signIn = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    const validationResult = signInSchema.safeParse(req.body);

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

    const { email, password } = validationResult.data;

    const user = await authenticateUser({ email, password });

    const token = jwttoken.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Use appropriate cookie utility
    if (isFastifyRequest) {
      cookiesFastify.set(reply, 'token', token);
    } else {
      cookies.set(res, 'token', token);
    }

    logger.info(`User signed in successfully: ${email}`);
    const redirectTo = req.query?.redirectTo;
    const accept = req.headers['accept'] || '';

    if (
      redirectTo ||
      (typeof accept === 'string' && accept.includes('text/html'))
    ) {
      const redirectUrl = redirectTo || '/api/test-openai';
      if (isFastifyRequest) {
        return reply.redirect(302, redirectUrl);
      }
      return res.redirect(302, redirectUrl);
    }

    const response = {
      message: 'User signed in successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    if (isFastifyRequest) {
      return reply.status(200).send(response);
    }
    return res.status(200).json(response);
  } catch (e) {
    logger.error('Sign in error', e);

    if (e.message === 'User not found' || e.message === 'Invalid password') {
      if (isFastifyRequest) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Error handling
    if (isFastifyRequest) {
      throw e; // Fastify handles errors via error handler
    }
    next(e); // Express uses next()
  }
};

export const signOut = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    // Use appropriate cookie utility
    if (isFastifyRequest) {
      cookiesFastify.clear(reply, 'token');
    } else {
      cookies.clear(res, 'token');
    }

    logger.info('User signed out successfully');

    const response = {
      message: 'User signed out successfully',
    };

    if (isFastifyRequest) {
      return reply.status(200).send(response);
    }
    return res.status(200).json(response);
  } catch (e) {
    logger.error('Sign out error', e);

    // Error handling
    if (isFastifyRequest) {
      throw e; // Fastify handles errors via error handler
    }
    next(e); // Express uses next()
  }
};
