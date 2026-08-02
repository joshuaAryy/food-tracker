import { z } from 'zod';

export const AUTH_ERROR_CODES = [
  'AUTHORIZATION_REQUIRED',
  'INVALID_AUTHORIZATION',
  'INVALID_AUTH_TOKEN',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_REVOKED',
  'RECENT_AUTH_REQUIRED',
  'ACCOUNT_DELETION_IN_PROGRESS',
  'EMAIL_VERIFICATION_REQUIRED',
  'AUTH_CONFIGURATION_ERROR',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const authErrorCodeSchema = z.enum(AUTH_ERROR_CODES);

export const accountDeletionResponseSchema = z.object({
  deleted: z.literal(true),
});

export type AccountDeletionResponse = z.infer<
  typeof accountDeletionResponseSchema
>;
