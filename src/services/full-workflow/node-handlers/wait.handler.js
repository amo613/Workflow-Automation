/**
 * Execute Wait Node
 * Waits for the specified duration
 */
export async function executeWait(data) {
  const duration = data.duration || 0;

  if (duration > 0) {
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
  }

  return {
    success: true,
    duration,
    waited: true,
  };
}
