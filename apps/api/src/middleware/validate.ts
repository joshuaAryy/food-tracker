import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../lib/errors.js';

type ValidationTarget = 'body' | 'query' | 'params';

type ValidatedValues = Partial<Record<ValidationTarget, unknown>>;

function validationMessage(issues: { message: string }[]): string {
  return issues[0]?.message ?? 'Request validation failed';
}

function validate(target: ValidationTarget, schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request[target]);

    if (!result.success) {
      next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          validationMessage(result.error.issues),
          { issues: result.error.issues },
        ),
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
