'use strict';
/**
 * Site24x7 APM – loaded first via node -r ./apm-require.cjs
 * Loads only .env.development or .env.production. Writes your key (SITE24X7_API_KEY)
 * into apminsightnode.json so the agent reads it from file; then the package's
 * dotenv.config() cannot overwrite it.
 */
var path = require('path');
var fs = require('fs');
var envFile = '.env.' + (process.env.NODE_ENV || 'development');
require('dotenv').config({ path: envFile });
var key = process.env.SITE24X7_API_KEY;
if (key) {
  var configPath = path.join(process.cwd(), 'apminsightnode.json');
  try {
    var config = { appName: 'Testing', port: 10000, licenseKey: key };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
}
require('apminsight');
