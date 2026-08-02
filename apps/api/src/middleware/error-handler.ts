import type { ErrorRequestHandler } from 'express';
import { emitServerDiagnostic } from '../lib/diagnostics.js';
import { AppError } from '../lib/errors.js';
import { toPublicError } from '../lib/public-errors.js';
import { sendError } from '../lib/responses.js';

function isMalformedJson(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    (error as { status?: unknown }).status === 400
  );
}

function isPayloadTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ((error as { type?: unknown }).type === 'entity.too.large' ||
      (error as { status?: unknown }).status === 413)
  );
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  void _next;

  if (isMalformedJson(error)) {
    sendError(response, 400, {
      code: 'VALIDATION_ERROR',
      message: 'Request body must contain valid JSON',
      details: {},
    });
    return;
  }

  if (isPayloadTooLarge(error)) {
    sendError(response, 413, {
      code: 'IMAGE_TOO_LARGE',
      message: 'The uploaded image is larger than 5 MiB.',
      details: {},
    });
    return;
  }

  if (!(error instanceof AppError)) {
    emitServerDiagnostic('request_failed', {
      operation: 'api_request',
      status: 500,
      requestId: response.locals.requestId,
      elapsedMs:
        typeof response.locals.requestStartedAt === 'number'
          ? Date.now() - response.locals.requestStartedAt
          : undefined,
      errorCategory: error instanceof Error ? 'exception' : 'unknown',
    });
  }

  const publicError = toPublicError(error);
  if (publicError.code !== 'INTERNAL_SERVER_ERROR') {
    sendError(response, publicError.status, {
      code: publicError.code,
      message: publicError.message,
      details: publicError.details,
    });
    return;
  }

  sendError(response, 500, {
    code: publicError.code,
    message: publicError.message,
    details: publicError.details,
  });
};
