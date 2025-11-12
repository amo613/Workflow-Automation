import OpenAI from 'openai';
import logger from '#config/logger.js';
import { getRedisClient } from '#config/cache.js';

const MEMORY_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Get memory from Redis
 * @param {string} memoryKey - Redis key for memory
 * @returns {Promise<Array>} - Array of messages
 */
async function getMemory(memoryKey) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return [];
    }

    const memoryStr = await redisClient.get(memoryKey);
    if (!memoryStr) {
      return [];
    }

    return JSON.parse(memoryStr);
  } catch (error) {
    logger.warn('Error getting memory from Redis', {
      error: error.message,
      memoryKey,
    });
    return [];
  }
}

/**
 * Save memory to Redis
 * @param {string} memoryKey - Redis key for memory
 * @param {Array} messages - Array of messages
 * @param {number} windowLength - Maximum number of messages to keep
 */
async function saveMemory(memoryKey, messages, windowLength) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return;
    }

    // Keep only the last N messages (excluding system messages)
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const systemMessages = messages.filter(m => m.role === 'system');

    // Keep last windowLength messages
    const recentMessages = nonSystemMessages.slice(-windowLength);

    // Combine system messages (always keep) with recent messages
    const finalMessages = [...systemMessages, ...recentMessages];

    await redisClient.set(
      memoryKey,
      JSON.stringify(finalMessages),
      'EX',
      MEMORY_TTL
    );
  } catch (error) {
    logger.warn('Error saving memory to Redis', {
      error: error.message,
      memoryKey,
    });
  }
}

/**
 * Call OpenAI Chat Completions API
 * @param {Object} options - API options
 * @param {string} options.apiKey - OpenAI API key
 * @param {string} options.model - Model name (gpt-4o, gpt-4o-mini, gpt-4-turbo, o1-mini)
 * @param {Array} options.messages - Array of messages
 * @param {number} options.temperature - Temperature (0-2)
 * @param {boolean} options.useCache - Whether to use prompt caching
 * @returns {Promise<Object>} - API response with output, usage, and cached info
 */
export async function callOpenAIChat({
  apiKey,
  model,
  messages,
  temperature = 1.0,
  useCache = true,
}) {
  try {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    if (!model) {
      throw new Error('Model is required');
    }

    if (!messages || messages.length === 0) {
      throw new Error('Messages are required');
    }

    const openai = new OpenAI({
      apiKey,
    });

    const requestOptions = {
      model,
      messages,
      temperature: Math.max(0, Math.min(2, temperature)),
    };

    // Note: Prompt caching is automatically enabled for gpt-4o and gpt-4o-mini
    // The API will automatically cache prompts and return cached_tokens in the usage object
    // No explicit cache_control parameter is needed

    logger.debug('Calling OpenAI Chat Completions', {
      model,
      messageCount: messages.length,
      temperature: requestOptions.temperature,
      useCache,
    });

    const response = await openai.chat.completions.create(requestOptions);

    const output = response.choices[0]?.message?.content || '';
    const usage = response.usage || {};
    const cachedTokens = usage.cached_tokens || 0;
    const wasCached = cachedTokens > 0;

    logger.info('OpenAI Chat Completions response', {
      model,
      outputLength: output.length,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cachedTokens,
      wasCached,
    });

    return {
      output,
      usage,
      cached: wasCached,
      cachedTokens,
    };
  } catch (error) {
    logger.error('Error calling OpenAI Chat Completions', {
      error: error.message,
      model,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Call OpenAI Chat with Memory
 * @param {Object} options - API options
 * @param {string} options.apiKey - OpenAI API key
 * @param {string} options.model - Model name
 * @param {string} options.prompt - User prompt
 * @param {string} options.systemPrompt - System prompt (optional)
 * @param {number} options.temperature - Temperature (0-2)
 * @param {boolean} options.useCache - Whether to use prompt caching
 * @param {boolean} options.useMemory - Whether to use memory
 * @param {string} options.memoryKey - Redis key for memory
 * @param {number} options.memoryWindowLength - Maximum number of messages in memory
 * @returns {Promise<Object>} - API response with output, usage, cached info, and memory
 */
export async function callOpenAIChatWithMemory({
  apiKey,
  model,
  prompt,
  systemPrompt,
  temperature = 1.0,
  useCache = true,
  useMemory = false,
  memoryKey,
  memoryWindowLength = 10,
}) {
  try {
    let messages = [];

    // Load memory if enabled
    if (useMemory && memoryKey) {
      messages = await getMemory(memoryKey);
    }

    // Add system prompt if provided (only if not already in memory)
    if (systemPrompt && !messages.some(m => m.role === 'system')) {
      messages.unshift({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Add user prompt
    messages.push({
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    });

    // Call OpenAI API
    const result = await callOpenAIChat({
      apiKey,
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      useCache,
    });

    // Add assistant response to memory
    if (useMemory && memoryKey) {
      messages.push({
        role: 'assistant',
        content: result.output,
        timestamp: Date.now(),
      });

      // Save memory with window limit
      await saveMemory(memoryKey, messages, memoryWindowLength);
    }

    return {
      ...result,
      memoryUsed: useMemory && memoryKey ? messages.length : 0,
    };
  } catch (error) {
    logger.error('Error calling OpenAI Chat with Memory', {
      error: error.message,
      model,
      useMemory,
      memoryKey,
    });
    throw error;
  }
}
