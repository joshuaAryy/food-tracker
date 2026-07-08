export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'AI_UNAVAILABLE'
  | 'TRUSTED_NUTRITION_AVAILABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function notFoundError(resource: string): AppError {
  return new AppError(404, 'NOT_FOUND', `${resource} not found`);
}
