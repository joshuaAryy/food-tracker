import { describe, expect, it } from 'vitest';
import {
  AUTH_ERROR_CODES,
  authErrorCodeSchema,
  type AuthErrorCode,
} from '../../../packages/shared/src/auth.js';
import { AppError, type ErrorCode } from '../src/lib/errors.js';

const EXPECTED_AUTH_ERROR_CODES = [
  'AUTHORIZATION_REQUIRED',
  'INVALID_AUTHORIZATION',
  'INVALID_AUTH_TOKEN',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_REVOKED',
  'EMAIL_VERIFICATION_REQUIRED',
  'AUTH_CONFIGURATION_ERROR',
] as const satisfies readonly AuthErrorCode[];

describe('shared authentication error contracts', () => {
  it('publishes the locked stable authentication codes', () => {
    expect(AUTH_ERROR_CODES).toEqual(EXPECTED_AUTH_ERROR_CODES);
    expect(authErrorCodeSchema.options).toEqual(EXPECTED_AUTH_ERROR_CODES);
  });

  it('allows authentication codes in the API error boundary', () => {
    const code: ErrorCode = 'AUTH_TOKEN_EXPIRED';
    expect(new AppError(401, code, 'internal token detail').code).toBe(code);
  });
});
