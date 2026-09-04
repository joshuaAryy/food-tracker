import type { RequestHandler } from 'express';
import type { DatabaseReadiness } from '../lib/database-readiness.js';

export function createDatabaseReadinessMiddleware(
  readiness: DatabaseReadiness,
): RequestHandler {
  return async (_request, _response, next): Promise<void> => {
    try {
      await readiness.ensureReady();
      next();
    } catch (error) {
      next(error);
    }
  };
}
