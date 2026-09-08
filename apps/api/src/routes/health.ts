import { Router } from 'express';
import type { DatabaseReadiness } from '../lib/database-readiness.js';

export function createHealthRouter(readiness: DatabaseReadiness): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  router.get('/ready', async (_request, response, next) => {
    try {
      await readiness.ensureReady();
      response.status(200).json({ status: 'ready' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
