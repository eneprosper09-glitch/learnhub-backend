import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSentry } from './config/sentry.js';
import app from './app.js';

initSentry();

const start = async () => {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
  });
};

start();