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

export const createWorkflowHandler = async (req, res, next) => {
  try {
    if (!req.user?.id) {
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
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
        errors: validationResult.error.errors,
        firstError: validationResult.error.errors[0],
      });
    }

    const workflow = await createWorkflow(req.user.id, validationResult.data);

    res.status(201).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Error in createWorkflowHandler:', error);
    next(error);
  }
};

export const getWorkflowHandler = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const idValidation = workflowIdSchema.safeParse({ id: req.params.id });
    if (!idValidation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(idValidation.error),
      });
    }

    const workflowId = parseInt(req.params.id, 10);
    const workflow = await getWorkflow(workflowId, req.user.id);

    res.status(200).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    if (error.message === 'Workflow not found') {
      return res.status(404).json({
        error: 'Workflow not found',
        message: error.message,
      });
    }
    logger.error('Error in getWorkflowHandler:', error);
    next(error);
  }
};

export const getAllWorkflowsHandler = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const workflows = await getAllWorkflows(req.user.id);

    res.status(200).json({
      success: true,
      data: workflows,
    });
  } catch (error) {
    logger.error('Error in getAllWorkflowsHandler:', error);
    next(error);
  }
};

export const updateWorkflowHandler = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const idValidation = workflowIdSchema.safeParse({ id: req.params.id });
    if (!idValidation.success) {
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

    res.status(200).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    if (error.message === 'Workflow not found') {
      return res.status(404).json({
        error: 'Workflow not found',
        message: error.message,
      });
    }
    logger.error('Error in updateWorkflowHandler:', error);
    next(error);
  }
};

export const deleteWorkflowHandler = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID not found',
      });
    }

    const idValidation = workflowIdSchema.safeParse({ id: req.params.id });
    if (!idValidation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(idValidation.error),
      });
    }

    const workflowId = parseInt(req.params.id, 10);
    await deleteWorkflow(workflowId, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Workflow not found') {
      return res.status(404).json({
        error: 'Workflow not found',
        message: error.message,
      });
    }
    logger.error('Error in deleteWorkflowHandler:', error);
    next(error);
  }
};
