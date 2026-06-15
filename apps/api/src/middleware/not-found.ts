import type { Request, Response } from 'express';
import { sendError } from '../lib/responses.js';

export function notFound(request: Request, response: Response): void {
  sendError(response, 404, {
    code: 'NOT_FOUND',
    message: `Route not found: ${request.method} ${request.path}`,
    details: {},
  });
}
