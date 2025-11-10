/**
 * If Node Handler
 * Note: If node branching is handled in executor.service.js
 * This handler is just a placeholder
 */
export async function executeIf(data, _context) {
  // If node evaluation is done in executor
  // This is just for consistency
  return {
    condition1: data.condition1,
    condition2: data.condition2,
    operator: data.operator || '==',
  };
}
