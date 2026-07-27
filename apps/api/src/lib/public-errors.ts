import { AppError, type ErrorCode } from './errors.js';

export interface PublicErrorEnvelope {
  status: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
}

const SAFE_RESOURCE_NAMES = new Set([
  'Food barcode',
  'Food item',
  'Food log',
  'Goals',
  'Profile',
  'Recommendation',
  'Recipe',
  'Recipe ingredient',
  'Tracking preferences',
  'Weight log',
]);

const SAFE_REASONS = new Set([
  'ambiguous_serving_option',
  'incompatible_unit',
  'invalid_quantity',
  'invalid_serving_option',
  'needs_review',
  'unknown_household_unit',
  'unsupported_unit',
]);

const SAFE_STATUSES = new Set(['needs_review']);

const DEFAULT_PUBLIC_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Request validation failed',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'Authentication is required.',
  AUTHORIZATION_REQUIRED: 'Authentication is required.',
  INVALID_AUTHORIZATION: 'Authentication could not be verified.',
  INVALID_AUTH_TOKEN: 'Authentication could not be verified.',
  AUTH_TOKEN_EXPIRED: 'Authentication has expired.',
  AUTH_TOKEN_REVOKED: 'Authentication is no longer valid.',
  EMAIL_VERIFICATION_REQUIRED: 'Email verification is required.',
  AUTH_CONFIGURATION_ERROR: 'Authentication is temporarily unavailable.',
  AI_UNAVAILABLE: 'Food recognition is temporarily unavailable.',
  RATE_LIMITED: 'Too many requests. Try again shortly.',
  INTERNAL_SERVER_ERROR: 'The request could not be completed.',
};

const PUBLIC_MESSAGES_BY_KEY = {
  barcode_invalid: 'Barcode must be a supported retail barcode.',
  nutrition_estimate_cut_off: 'AI nutrition estimates were cut off. Try again.',
  nutrition_estimate_unavailable:
    'AI nutrition estimates are temporarily unavailable.',
  photo_analysis_incomplete_photo:
    'Photo analysis could not be completed. Please try another photo.',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const key of ['entryIndex', 'itemIndex']) {
    const value = details[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      output[key] = value;
    }
  }

  if (typeof details.reason === 'string' && SAFE_REASONS.has(details.reason)) {
    output.reason = details.reason;
  }
  if (typeof details.status === 'string' && SAFE_STATUSES.has(details.status)) {
    output.status = details.status;
  }

  if (Array.isArray(details.fields)) {
    const fields = details.fields.flatMap((field) => {
      if (!isRecord(field)) return [];
      if (
        typeof field.field !== 'string' ||
        typeof field.reason !== 'string' ||
        !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(field.field) ||
        !/^[a-z_]+$/.test(field.reason)
      ) {
        return [];
      }
      return [{ field: field.field, reason: field.reason }];
    });
    if (fields.length > 0) output.fields = fields.slice(0, 20);
  }

  return output;
}

function publicMessage(code: string, details: Record<string, unknown>): string {
  const publicMessageKey = details.publicMessageKey;
  if (
    typeof publicMessageKey === 'string' &&
    publicMessageKey in PUBLIC_MESSAGES_BY_KEY
  ) {
    return PUBLIC_MESSAGES_BY_KEY[
      publicMessageKey as keyof typeof PUBLIC_MESSAGES_BY_KEY
    ];
  }
  if (code === 'NOT_FOUND' && typeof details.resource === 'string') {
    if (SAFE_RESOURCE_NAMES.has(details.resource)) {
      return `${details.resource} not found`;
    }
  }
  return DEFAULT_PUBLIC_MESSAGES[code] ?? 'The request could not be completed.';
}

export function toPublicError(error: unknown): PublicErrorEnvelope {
  if (error instanceof AppError) {
    return {
      status: error.status,
      code: error.code,
      message: publicMessage(error.code, error.details),
      details: safeDetails(error.details),
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'The request could not be completed.',
    details: {},
  };
}

export function isKnownErrorCode(value: string): value is ErrorCode {
  return value in DEFAULT_PUBLIC_MESSAGES;
}
