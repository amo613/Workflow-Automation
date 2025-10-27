import app from './app.js';
import 'dotenv/config';
import {configDotenv} from 'dotenv';
configDotenv({quiet: true});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Listening on http://Localhost:${PORT}`);
});

