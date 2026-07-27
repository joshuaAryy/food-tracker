import type { RequestHandler, Response } from 'express';
import type { ZodIssue, ZodType } from 'zod';
import { AppError } from '../lib/errors.js';

type ValidationTarget = 'body' | 'query' | 'params';

type ValidatedValues = Partial<Record<ValidationTarget, unknown>>;

const VALIDATION_FIELDS = new Set([
  'name',
  'email',
  'password',
  'age',
  'birthDate',
  'sex',
  'heightInches',
  'startingWeightLb',
  'activityLevel',
  'trainingStyle',
  'foodName',
  'description',
  'mealType',
  'calories',
  'protein',
  'carbs',
  'fat',
  'weightLb',
  'loggedAt',
  'timezone',
  'goalPace',
  'targetWeightLb',
  'targetCalories',
  'targetProteinGrams',
]);

function validationFields(issues: readonly ZodIssue[]) {
  return issues.flatMap((issue) => {
    const field = issue.path.find(
      (part): part is string =>
        typeof part === 'string' && VALIDATION_FIELDS.has(part),
    );
    if (field === undefined) return [];
    return [
      {
        field,
        reason:
          issue.code === 'invalid_type' || issue.code === 'too_small'
            ? 'required'
            : 'invalid',
      },
    ];
  });
}

function validate(target: ValidationTarget, schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request[target]);

    if (!result.success) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', {
          fields: validationFields(result.error.issues),
        }),
      );
      return;
    }

    const validated = (response.locals.validated ?? {}) as ValidatedValues;
    validated[target] = result.data;
    response.locals.validated = validated;
    next();
  };
}

export const validateBody = (schema: ZodType): RequestHandler =>
  validate('body', schema);

export const validateQuery = (schema: ZodType): RequestHandler =>
  validate('query', schema);

export const validateParams = (schema: ZodType): RequestHandler =>
  validate('params', schema);

export function validatedBody<T>(response: Response): T {
  return ((response.locals.validated ?? {}) as ValidatedValues).body as T;
}

export function validatedQuery<T>(response: Response): T {
  return ((response.locals.validated ?? {}) as ValidatedValues).query as T;
}

export function validatedParams<T>(response: Response): T {
  return ((response.locals.validated ?? {}) as ValidatedValues).params as T;
}
