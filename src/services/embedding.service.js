import OpenAI from 'openai';
import { OPENAI_API_KEY } from '#config/env.js';
import logger from '#config/logger.js';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Cache for embeddings to avoid regenerating
const embeddingCache = new Map();

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text must be a non-empty string');
  }

  // Check cache
  const cacheKey = text.trim().toLowerCase();
  if (embeddingCache.has(cacheKey)) {
    logger.debug('Using cached embedding', { text: text.substring(0, 50) });
    return embeddingCache.get(cacheKey);
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensions
      input: text.trim(),
    });

    const embedding = response.data[0].embedding;

    // Cache the embedding
    embeddingCache.set(cacheKey, embedding);

    logger.debug('Generated embedding', {
      text: text.substring(0, 50),
      dimensions: embedding.length,
    });

    return embedding;
  } catch (error) {
    logger.error('Error generating embedding', {
      error: error.message,
      text: text.substring(0, 50),
    });
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function batchGenerateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }

  // Filter out empty texts and check cache
  const validTexts = texts.filter(
    text => text && typeof text === 'string' && text.trim().length > 0
  );

  if (validTexts.length === 0) {
    throw new Error('No valid texts to embed');
  }

  // Check cache for all texts
  const uncachedTexts = [];
  const cachedEmbeddings = [];

  validTexts.forEach(text => {
    const cacheKey = text.trim().toLowerCase();
    if (embeddingCache.has(cacheKey)) {
      cachedEmbeddings.push(embeddingCache.get(cacheKey));
    } else {
      uncachedTexts.push(text);
    }
  });

  // If all are cached, return cached embeddings
  if (uncachedTexts.length === 0) {
    logger.debug('All embeddings from cache', { count: validTexts.length });
    return cachedEmbeddings;
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: uncachedTexts.map(t => t.trim()),
    });

    const newEmbeddings = response.data.map(item => item.embedding);

    // Cache new embeddings
    uncachedTexts.forEach((text, index) => {
      const cacheKey = text.trim().toLowerCase();
      embeddingCache.set(cacheKey, newEmbeddings[index]);
    });

    // Combine cached and new embeddings in correct order
    const allEmbeddings = [];
    let cachedIndex = 0;
    let newIndex = 0;

    validTexts.forEach(text => {
      const cacheKey = text.trim().toLowerCase();
      if (
        embeddingCache.has(cacheKey) &&
        cachedIndex < cachedEmbeddings.length
      ) {
        allEmbeddings.push(cachedEmbeddings[cachedIndex]);
        cachedIndex++;
      } else {
        allEmbeddings.push(newEmbeddings[newIndex]);
        newIndex++;
      }
    });

    logger.debug('Generated batch embeddings', {
      total: validTexts.length,
      cached: cachedEmbeddings.length,
      new: newEmbeddings.length,
    });

    return allEmbeddings;
  } catch (error) {
    logger.error('Error generating batch embeddings', {
      error: error.message,
      count: validTexts.length,
    });
    throw error;
  }
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache() {
  embeddingCache.clear();
  logger.debug('Embedding cache cleared');
}
