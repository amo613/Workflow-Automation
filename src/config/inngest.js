import { Inngest } from 'inngest';
import logger from '#config/logger.js';
import {
  INNGEST_SIGNING_KEY,
  INNGEST_EVENT_KEY,
  INNGEST_APP_ID,
  NODE_ENV,
} from '#config/env.js';

// Inngest Client Konfiguration
// Wichtig: In Development KEIN signingKey setzen - sonst wird Cloud-Mode erzwungen
const inngestConfig = {
  id: INNGEST_APP_ID || 'acquisitions-app',
};

if (NODE_ENV === 'development') {
  // Development: Dev Server nutzen, keine Keys nötig
  inngestConfig.signingKey = undefined;
  inngestConfig.eventKey = undefined;
  inngestConfig.isDev = true;
  inngestConfig.baseUrl = 'http://host.docker.internal:8288';
  logger.info('Development mode: Using dev server (no signing key)');
} else {
  // Production: Keys aus Environment Variables
  if (INNGEST_SIGNING_KEY) {
    inngestConfig.signingKey = INNGEST_SIGNING_KEY;
  } else {
    logger.warn(
      'INNGEST_SIGNING_KEY not set - Inngest authentication will fail in production'
    );
  }

  if (INNGEST_EVENT_KEY) {
    inngestConfig.eventKey = INNGEST_EVENT_KEY;
  } else {
    logger.warn(
      'INNGEST_EVENT_KEY not set - Cannot send events to Inngest in production'
    );
  }
}
const inngest = new Inngest(inngestConfig);

export { inngest };

logger.info('Inngest client initialized', {
  appId: inngestConfig.id,
  mode: NODE_ENV,
  hasSigningKey: !!inngestConfig.signingKey,
  hasEventKey: !!inngestConfig.eventKey,
  baseUrl: inngestConfig.baseUrl || null,
});

export default inngest;
