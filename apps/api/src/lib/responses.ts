import type { Response } from 'express';
import type { ApiError, SuccessResponse } from '@food-tracker/shared';

export function sendSuccess<T>(response: Response, data: T): void {
  const body: SuccessResponse<T> = { success: true, data };
  response.json(body);
}

export function sendError(
  response: Response,
  status: number,
  error: ApiError,
): void {
  response.status(status).json({ success: false, error });
}
