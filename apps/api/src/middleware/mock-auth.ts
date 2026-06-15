import type { NextFunction, Request, Response } from 'express';
import { MOCK_USER_ID } from '@food-tracker/shared';

export function mockAuth(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.locals.userId = MOCK_USER_ID;
  next();
}
