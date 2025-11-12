import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';
import { callOpenAIChatWithMemory } from '#services/openai-chat.service.js';
import { decryptApiKey } from '#utils/encryption.utils.js';
import { OPENAI_API_KEY } from '#config/env.js';
import { db } from '#config/database.js';
import { userOpenAiKeys } from '#models/user-openai-keys.model.js';
import { eq } from 'drizzle-orm';

/**
 * Get API key for user (from database or use global)
 * @param {number} userId - User ID
 * @returns {Promise<string|null>} - Decrypted API key or null
 */
async function getUserApiKey(userId) {
  try {
    // Try to get user's API key from database
    const [userKey] = await db
      .select()
      .from(userOpenAiKeys)
      .where(eq(userOpenAiKeys.user_id, userId))
      .limit(1);

    if (userKey && userKey.encrypted_api_key) {
      try {
        const decryptedKey = decryptApiKey(userKey.encrypted_api_key);
        return decryptedKey;
      } catch (error) {
        logger.warn('Failed to decrypt user API key', {
          userId,
          error: error.message,
        });
      }
    }

    // Fallback to global API key
    if (OPENAI_API_KEY) {
      return OPENAI_API_KEY;
    }

    return null;
  } catch (error) {
    logger.error('Error getting user API key', {
      userId,
      error: error.message,
    });
    // Fallback to global API key
    return OPENAI_API_KEY || null;
  }
}

/**
 * Execute AI Agent Node
 * @param {Object} node - Node object
 * @param {Object} templateContext - Template context for variable resolution
 * @returns {Promise<Object>} - Node output
 */
export async function executeAiAgent(node, templateContext) {
  const { data } = node;
  const workflowId = templateContext.workflowId;
  const userId =
    templateContext.userId || templateContext.workflowInput?.userId;

  logger.info('Executing AI Agent Node', {
    nodeId: node.id,
    workflowId,
    userId,
    hasPrompt: !!data.prompt,
    hasSystemPrompt: !!data.systemPrompt,
    model: data.model,
  });

  // Extract node data
  const {
    prompt,
    systemPrompt,
    model = 'gpt-4o',
    temperature = 1.0,
    useMemory = false,
    memoryWindowLength = 10,
    apiKey: nodeApiKey, // Encrypted API key from node data (optional)
  } = data;

  if (!prompt) {
    throw new Error('Prompt is required for AI Agent node');
  }

  // Resolve templates
  const resolvedPrompt = resolveTemplate(prompt, templateContext);
  const resolvedSystemPrompt = systemPrompt
    ? resolveTemplate(systemPrompt, templateContext)
    : null;

  logger.debug('AI Agent Node templates resolved', {
    nodeId: node.id,
    promptLength: resolvedPrompt.length,
    systemPromptLength: resolvedSystemPrompt?.length || 0,
  });

  // Get API key (priority: node API key > user API key > global API key)
  let apiKey = null;

  if (nodeApiKey) {
    try {
      apiKey = decryptApiKey(nodeApiKey);
    } catch (error) {
      logger.warn('Failed to decrypt node API key, trying user API key', {
        nodeId: node.id,
        error: error.message,
      });
    }
  }

  if (!apiKey && userId) {
    apiKey = await getUserApiKey(userId);
  }

  if (!apiKey) {
    throw new Error(
      'OpenAI API key is required. Please set it in the node settings or use the global API key.'
    );
  }

  // Build memory key
  const memoryKey = useMemory
    ? `ai-agent:${workflowId}:${node.id}:memory`
    : null;

  // Call OpenAI API
  try {
    const result = await callOpenAIChatWithMemory({
      apiKey,
      model,
      prompt: resolvedPrompt,
      systemPrompt: resolvedSystemPrompt,
      temperature: parseFloat(temperature) || 1.0,
      useCache: true,
      useMemory: useMemory && !!memoryKey,
      memoryKey,
      memoryWindowLength: parseInt(memoryWindowLength) || 10,
    });

    logger.info('AI Agent Node executed successfully', {
      nodeId: node.id,
      model,
      outputLength: result.output.length,
      cached: result.cached,
      memoryUsed: result.memoryUsed || 0,
    });

    return {
      output: result.output,
      model,
      usage: result.usage,
      cached: result.cached,
      cachedTokens: result.cachedTokens || 0,
      memoryUsed: result.memoryUsed || 0,
    };
  } catch (error) {
    logger.error('AI Agent Node execution failed', {
      nodeId: node.id,
      model,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
