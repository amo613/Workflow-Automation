/* eslint-env browser */
/**
 * Knowledge Base Service
 * Handles all API calls related to knowledge base
 */
export const knowledgeBaseService = {
  async fetchEntries() {
    const response = await fetch('/api/knowledge-base', {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch entries');
    const data = await response.json();
    return data.data || [];
  },
};
