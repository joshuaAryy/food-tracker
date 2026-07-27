import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { CorsOptions } from 'cors';
import type { Express, RequestHandler } from 'express';
import { API_BASE_PATH } from '@food-tracker/shared';
import { errorHandler } from './middleware/error-handler.js';
import { createFirebaseAuthMiddleware } from './middleware/firebase-auth.js';
import { notFound } from './middleware/not-found.js';
import { requestContext } from './middleware/request-context.js';
import { apiRouter } from './routes/api.js';

export function createApp(
  authMiddleware: RequestHandler = createFirebaseAuthMiddleware(),
): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext());
  app.use(helmet());
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  const configuredCorsOrigins = new Set(
    (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      callback(null, origin === undefined || configuredCorsOrigins.has(origin));
    },
    credentials: false,
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '5mb', strict: true }));
  app.use(API_BASE_PATH, authMiddleware, apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
