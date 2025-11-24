/**
 * Switch Node Handler
 * Note: Switch node branching is handled in executor.service.js
 * This handler is just a placeholder for consistency
 */
export async function executeSwitch(data, _context) {
  // Switch node evaluation is done in executor
  // This is just for consistency
  return {
    value: data.value,
    cases: data.cases || [],
    hasDefault: data.hasDefault !== false,
  };
}
