import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { CorsOptions } from 'cors';
import type { Express, RequestHandler } from 'express';
import { API_BASE_PATH } from '@food-tracker/shared';
import { emitServerDiagnostic } from './lib/diagnostics.js';
import { errorHandler } from './middleware/error-handler.js';
import {
  createFirebaseAuthMiddleware,
  createFirebaseDeletionAuthMiddleware,
} from './middleware/firebase-auth.js';
import { notFound } from './middleware/not-found.js';
import { requestContext } from './middleware/request-context.js';
import { apiRouter } from './routes/api.js';
import { healthRouter } from './routes/health.js';
import { createAccountRouter } from './modules/account/routes.js';

export function createApp(
  authMiddleware: RequestHandler = createFirebaseAuthMiddleware(),
): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext());
  app.use((request, _response, next) => {
    const operation =
      request.path === '/health'
        ? 'health'
        : request.path.startsWith(API_BASE_PATH)
          ? 'api_route'
          : 'other_route';
    emitServerDiagnostic('api_request_received', { operation });
    next();
  });
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
  app.use('/health', healthRouter);
  app.use(
    `${API_BASE_PATH}/account`,
    createFirebaseDeletionAuthMiddleware(),
    createAccountRouter(),
  );
  app.use(API_BASE_PATH, authMiddleware, apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
