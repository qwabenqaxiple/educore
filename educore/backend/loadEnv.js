const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Determine which env file to load based on APP_ENV
const appEnv = process.env.APP_ENV || 'development';
const envFile = `.env.${appEnv}`;
const envPath = path.resolve(__dirname, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Fall back to the default .env
  dotenv.config();
}
