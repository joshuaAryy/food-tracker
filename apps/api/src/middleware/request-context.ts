import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export interface RequestContextLocals {
  requestId: string;
  requestStartedAt: number;
}

export interface RequestContextOptions {
  createRequestId?: () => string;
  now?: () => number;
}

export function requestContext(
  options: RequestContextOptions = {},
): RequestHandler {
  const createRequestId =
    options.createRequestId ?? (() => `req_${randomUUID()}`);
  const now = options.now ?? Date.now;

  return (_request, response, next) => {
    const locals = response.locals as RequestContextLocals;
    locals.requestId = createRequestId();
    locals.requestStartedAt = now();
    next();
  };
}
