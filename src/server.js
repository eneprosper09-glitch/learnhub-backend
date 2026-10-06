import { createServer } from 'http';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSentry } from './config/sentry.js';
import app from './app.js';
import { initSocket } from './socket/index.js';

initSentry();

const start = async () => {
  await connectDB();

  const httpServer = createServer(app);
  initSocket(httpServer, app);

  httpServer.listen(env.port, () => {
    console.log(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
  });
};

start();