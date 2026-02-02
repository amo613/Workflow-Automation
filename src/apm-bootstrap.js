/**
 * APM Insight (Site24x7) – must run before any other app code.
 * Maps SITE24X7_API_KEY to APMINSIGHT_LICENSE_KEY so Railway env works.
 */
if (process.env.SITE24X7_API_KEY && !process.env.APMINSIGHT_LICENSE_KEY) {
  process.env.APMINSIGHT_LICENSE_KEY = process.env.SITE24X7_API_KEY;
}
const apminsight = (await import('apminsight')).default;
apminsight.config();
