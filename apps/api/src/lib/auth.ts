import type { Response } from 'express';
import { AppError } from './errors.js';

export function currentUserId(response: Response): string {
  const userId = response.locals.userId as unknown;

  if (typeof userId !== 'string') {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required');
  }

  return userId;
}
