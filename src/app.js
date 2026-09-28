import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { jsonLogger } from './middleware/logger.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

const app = express();

app.use(requestId);

app.use(
  helmet({
    contentSecurityPolicy: env.nodeEnv === 'production' ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = [env.corsOrigin, 'http://localhost:5174'].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (env.nodeEnv === 'production') {
  app.use(jsonLogger);
} else {
  app.use(morgan('dev'));
}

app.use('/api/v1', globalLimiter);
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;