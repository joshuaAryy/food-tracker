import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  File: class File {},
}));
vi.stubGlobal('__DEV__', false);

import {
  api,
  ApiClientError,
  errorMessage,
  parseApiResponse,
} from './api-client';
import { toUserFacingError } from './user-facing-errors';

describe('mobile user-facing error boundary', () => {
  it('does not expose a LAN API URL for a connection failure', () => {
    const error = new ApiClientError(
      'Could not reach the API at http://192.168.1.42:3000/api/v1.',
      'NETWORK_ERROR',
      0,
    );

    expect(errorMessage(error)).toBe(
      'We couldn’t connect. Check your connection and try again.',
    );
  });

  it('does not expose a raw validation message or details', () => {
    const error = new ApiClientError(
      'PrismaClientKnownRequestError: SELECT * FROM "User"',
      'VALIDATION_ERROR',
      400,
      {
        issues: [
          {
            path: ['user', 'privateField'],
            message: 'DATABASE_URL=postgresql://user:password@host/database',
          },
        ],
      },
    );

    expect(errorMessage(error)).toBe(
      'Please check the highlighted values and try again.',
    );
  });

  it('discards untrusted API error message and details at the parser boundary', async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'DATABASE_URL=postgresql://user:password@host/database',
          details: {
            stack: '/Users/joshua/food_tracker/apps/api/src/server.ts',
            providerBody: 'Authorization: Bearer test-secret-token',
          },
        },
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );

    await expect(parseApiResponse(response)).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      message: 'The request could not be completed.',
      details: {},
    });
  });

  it('does not put the configured API URL into a connection error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connection failed')),
    );

    await expect(api.dashboard.summary()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });

    try {
      await api.dashboard.summary();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError);
      expect((error as Error).message).not.toMatch(
        /https?:\/\/|localhost|\/api\/v1|192\.168\./,
      );
    }
  });

  it('retains only allowlisted public error metadata', async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: {
            fields: [{ field: 'email', reason: 'invalid' }],
            entryIndex: 2,
            itemIndex: 1,
            issues: [{ path: ['secret'], message: 'private value' }],
            stack: '/Users/joshua/food_tracker/apps/api/src/server.ts',
          },
        },
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );

    await expect(parseApiResponse(response)).rejects.toMatchObject({
      details: {
        fields: [{ field: 'email', reason: 'invalid' }],
        entryIndex: 2,
        itemIndex: 1,
      },
    });
  });

  it.each([
    ['INVALID_RESPONSE', 'We received an unexpected response. Try again.'],
    ['INTERNAL_SERVER_ERROR', 'Something went wrong. Please try again.'],
    [
      'AI_UNAVAILABLE',
      'Food recognition is temporarily unavailable. Try again shortly.',
    ],
    ['RATE_LIMITED', 'Too many requests. Try again shortly.'],
    ['NOT_FOUND', 'We couldn’t find that item. Refresh and try again.'],
    ['AUTH_TOKEN_EXPIRED', 'Your session has expired. Please sign in again.'],
    [
      'EMAIL_VERIFICATION_REQUIRED',
      'Please verify your email before continuing.',
    ],
  ])('maps %s to safe product copy', (code, expected) => {
    const error = new ApiClientError(
      'Gemini generateContent failed: DATABASE_URL=secret',
      code,
      500,
      { providerBody: 'Authorization: Bearer test-secret-token' },
    );

    expect(toUserFacingError(error)).toBe(expected);
    expect(toUserFacingError(error)).not.toMatch(
      /Gemini|DATABASE_URL|Authorization|Bearer|secret/,
    );
  });

  it.each([
    ['INVALID_DIMENSIONS', 'Choose another image.'],
    ['NORMALIZATION_FAILED', 'The photo could not be prepared. Try again.'],
    ['PHOTO_TOO_LARGE', 'The photo is too large. Choose another image.'],
  ])('maps local photo error %s safely', (code, expected) => {
    expect(
      toUserFacingError({
        code,
        message: '/Users/joshua/food_tracker/private-photo-path',
      }),
    ).toContain(expected);
    expect(
      toUserFacingError({
        code,
        message: '/Users/joshua/food_tracker/private-photo-path',
      }),
    ).not.toContain('/Users/');
  });

  it('does not trust an unsafe fallback message supplied by a callsite', () => {
    expect(
      toUserFacingError(
        { code: 'unknown' },
        'POST /api/v1/ai/food-parse failed at http://192.168.1.42:3000',
      ),
    ).toBe('The request could not be completed. Please try again.');
  });

  it('does not ship concrete local host literals in the user-facing boundary', () => {
    const source = readFileSync(
      new URL('./user-facing-errors.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toContain('localhost');
    expect(source).not.toContain('127.0.0.1');
  });
});
