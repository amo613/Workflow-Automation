/**
 * Convert text to camelCase variable name
 * Examples:
 * - "product name" -> "productName"
 * - "user name" -> "userName"
 * - "productName" -> "productName" (already camelCase)
 * - "Product Name" -> "productName"
 */
export function toCamelCase(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Trim and split by whitespace
  const words = text.trim().split(/\s+/);

  if (words.length === 0) {
    return '';
  }

  // First word is lowercase
  const firstWord = words[0].toLowerCase();

  // Remaining words: capitalize first letter, lowercase rest
  const restWords = words.slice(1).map(word => {
    if (word.length === 0) return '';
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  });

  return firstWord + restWords.join('');
}

/**
 * Normalize variable name in text (replace {variableName} with camelCase version)
 * @param {string} text - Text containing variables
 * @param {Object} variableMap - Map of original names to camelCase names (optional)
 * @returns {string} Text with normalized variable names
 */
export function normalizeVariablesInText(text, variableMap = {}) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let normalizedText = text;

  // First, replace variables from the map (from knowledge base)
  Object.entries(variableMap).forEach(([original, normalized]) => {
    const pattern = new RegExp(
      `\\{${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`,
      'g'
    );
    normalizedText = normalizedText.replace(pattern, `{${normalized}}`);
  });

  // Then, normalize any remaining variables that weren't in the map (manually entered)
  // Find all {variableName} patterns and normalize them
  const variablePattern = /\{([^}]+)\}/g;
  normalizedText = normalizedText.replace(
    variablePattern,
    (match, variableName) => {
      const normalized = toCamelCase(variableName);
      return `{${normalized}}`;
    }
  );

  return normalizedText;
}
