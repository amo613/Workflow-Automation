import logger from '#config/logger.js';
import {
  createWorkflow,
  getWorkflow,
  getAllWorkflows,
  updateWorkflow,
  deleteWorkflow,
} from '#services/workflow.service.js';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  workflowIdSchema,
} from '#validations/workflow.validation.js';
import { formatValidationError } from '#utils/format.js';

// Helper: Detect if this is Fastify (has reply) or Express (has res)
const isFastify = reply =>
  reply &&
  typeof reply.send === 'function' &&
  typeof reply.status === 'function';

export const createWorkflowHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    if (!req.user?.id) {
      if (isFastifyRequest) {
        return reply.status(401).send({
          error: 'Authentication required',
          message: 'User ID not found',
        });
      }
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const validationResult = createWorkflowSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.error('Workflow validation failed:', {
        errors: validationResult.error.errors,
        errorCount: validationResult.error.errors.length,
        firstError: validationResult.error.errors[0],
        body: JSON.stringify(req.body, null, 2),
        graphJsonNodes: req.body?.graph_json?.nodes?.length,
        graphJsonEdges: req.body?.graph_json?.edges?.length,
      });
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(validationResult.error),
          errors: validationResult.error.errors,
          firstError: validationResult.error.errors[0],
        });
      }
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
        errors: validationResult.error.errors,
        firstError: validationResult.error.errors[0],
      });
    }

    const workflow = await createWorkflow(req.user.id, validationResult.data);

    if (isFastifyRequest) {
      return reply.status(201).send({
        success: true,
        data: workflow,
      });
    }
    res.status(201).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Error in createWorkflowHandler:', error);
    if (isFastifyRequest) {
      throw error; // Fastify handles errors via error handler
    }
    next(error); // Express uses next()
  }
};

export const getWorkflowHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    if (!req.user?.id) {
      if (isFastifyRequest) {
        return reply.status(401).send({
          error: 'Authentication required',
          message: 'User ID not found',
        });
      }
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const idValidation = workflowIdSchema.safeParse({ id: req.params.id });
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

    const workflowId = parseInt(req.params.id, 10);
    const workflow = await getWorkflow(workflowId, req.user.id);

    if (isFastifyRequest) {
      return reply.status(200).send({
        success: true,
        data: workflow,
      });
    }
    res.status(200).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    if (error.message === 'Workflow not found') {
      if (isFastifyRequest) {
        return reply.status(404).send({
          error: 'Workflow not found',
          message: error.message,
        });
      }
      return res.status(404).json({
        error: 'Workflow not found',
        message: error.message,
      });
    }
    logger.error('Error in getWorkflowHandler:', error);
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};

export const getAllWorkflowsHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    if (!req.user?.id) {
      if (isFastifyRequest) {
        return reply.status(401).send({
          error: 'Authentication required',
          message: 'User ID not found',
        });
      }
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const workflows = await getAllWorkflows(req.user.id);

    if (isFastifyRequest) {
      return reply.status(200).send({
        success: true,
        data: workflows,
      });
    }
    res.status(200).json({
      success: true,
      data: workflows,
    });
  } catch (error) {
    logger.error('Error in getAllWorkflowsHandler:', error);
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};

export const updateWorkflowHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    if (!req.user?.id) {
      if (isFastifyRequest) {
        return reply.status(401).send({
          error: 'Authentication required',
          message: 'User ID not found',
        });
      }
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const idValidation = workflowIdSchema.safeParse({ id: req.params.id });
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

    const validationResult = updateWorkflowSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.error('Workflow update validation failed:', {
        errors: validationResult.error.errors,
        body: JSON.stringify(req.body, null, 2),
      });
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(validationResult.error),
          errors: validationResult.error.errors,
        });
      }
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
        errors: validationResult.error.errors,
      });
    }

    const workflowId = parseInt(req.params.id, 10);
    const workflow = await updateWorkflow(
      workflowId,
      req.user.id,
      validationResult.data
    );

    if (isFastifyRequest) {
      return reply.status(200).send({
        success: true,
        data: workflow,
      });
    }
    res.status(200).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    if (error.message === 'Workflow not found') {
      if (isFastifyRequest) {
        return reply.status(404).send({
          error: 'Workflow not found',
          message: error.message,
        });
      }
      return res.status(404).json({
        error: 'Workflow not found',
        message: error.message,
      });
    }
    logger.error('Error in updateWorkflowHandler:', error);
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};

export const deleteWorkflowHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    if (!req.user?.id) {
      if (isFastifyRequest) {
        return reply.status(401).send({
          error: 'Authentication required',
          message: 'User ID not found',
        });
      }
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const idValidation = workflowIdSchema.safeParse({ id: req.params.id });
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

    const workflowId = parseInt(req.params.id, 10);
    await deleteWorkflow(workflowId, req.user.id);

    if (isFastifyRequest) {
      return reply.status(200).send({
        success: true,
        message: 'Workflow deleted successfully',
      });
    }
    res.status(200).json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Workflow not found') {
      if (isFastifyRequest) {
        return reply.status(404).send({
          error: 'Workflow not found',
          message: error.message,
        });
      }
      return res.status(404).json({
        error: 'Workflow not found',
        message: error.message,
      });
    }
    logger.error('Error in deleteWorkflowHandler:', error);
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};
