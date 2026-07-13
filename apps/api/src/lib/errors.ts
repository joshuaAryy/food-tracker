export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'AI_UNAVAILABLE'
  | 'TRUSTED_NUTRITION_AVAILABLE'
  | 'RATE_LIMITED'
  | 'SERVING_CONFLICT'
  | 'INVALID_SERVING_REQUEST'
  | 'SERVING_NEEDS_REVIEW'
  | 'SERVING_RESOLUTION_INVALID'
  | 'INVALID_SERVING_BASIS'
  | 'SERVING_UPDATE_UNAVAILABLE'
  | 'SERVING_OPTION_UNAVAILABLE'
  | 'SERVING_OVERRIDE_ACTION_REQUIRED'
  | 'SERVING_UPDATE_CONFLICT'
  | 'SNAPSHOT_NUTRITION_EDIT_REQUIRES_OVERRIDE'
  | 'RECIPE_LAST_INGREDIENT'
  | 'RECIPE_FINAL_WEIGHT_REQUIRED'
  | 'RECIPE_LOG_IMMUTABLE'
  | 'MIXED_MEAL_LOG_IMMUTABLE'
  | 'FOOD_LOG_NOT_REUSABLE'
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
