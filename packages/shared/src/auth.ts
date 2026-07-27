import { z } from 'zod';

export const AUTH_ERROR_CODES = [
  'AUTHORIZATION_REQUIRED',
  'INVALID_AUTHORIZATION',
  'INVALID_AUTH_TOKEN',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_REVOKED',
  'EMAIL_VERIFICATION_REQUIRED',
  'AUTH_CONFIGURATION_ERROR',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const authErrorCodeSchema = z.enum(AUTH_ERROR_CODES);
