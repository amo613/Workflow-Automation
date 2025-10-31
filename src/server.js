import app from './app.js';
import 'dotenv/config';
import { configDotenv } from 'dotenv';
import logger from '#config/logger.js';
configDotenv({ quiet: true });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Listening on http://Localhost:${PORT}`);
});
