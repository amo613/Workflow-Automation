/**
 * Return the explicitly configured public application URL.
 * OAuth callbacks must never guess their redirect target from request headers.
 */
export function getRequiredAppUrl() {
  const configuredUrl = process.env.FRONTEND_URL || process.env.PUBLIC_URL;

  if (!configuredUrl) {
    throw new Error('FRONTEND_URL or PUBLIC_URL must be configured');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error('FRONTEND_URL or PUBLIC_URL must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('FRONTEND_URL or PUBLIC_URL must use HTTP or HTTPS');
  }

  return configuredUrl.replace(/\/+$/, '');
}
