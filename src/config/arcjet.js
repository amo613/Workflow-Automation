import arcjet, { shield, detectBot, slidingWindow } from '@arcjet/node';
import { ARCJET_KEY } from '#config/env.js';

const aj = arcjet({
  // Get your site key from https://app.arcjet.com and set it as an environment
  // variable rather than hard coding.
  key: ARCJET_KEY,
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: 'LIVE' }),
    // Create a bot detection rule
    detectBot({
      mode: 'LIVE', // Blocks requests. Use "DRY_RUN" to log only
      // Block all bots except the following
      allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW'],
    }),
    /* Global rate limit removed - using role-based rate limiting in security.middleware.js instead
     role-based limits so 5 for guests, 10 for users, 20 for admins per minute provides better control*/
  ],
});

export default aj;
