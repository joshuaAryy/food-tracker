import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  File: class File {},
}));

import { api, ApiClientError, configureApiAuthSession } from './api-client';
import type { ApiAuthSession } from './api-auth-session';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function authSession(overrides: Partial<ApiAuthSession> = {}): ApiAuthSession {
  return {
    getIdToken: vi.fn().mockResolvedValue('initial-token'),
    clearSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('central API authentication session', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    configureApiAuthSession(null);
    vi.unstubAllGlobals();
  });

  it('attaches the current token and retries an expired response once with rebuilt headers', async () => {
    const getIdToken = vi
      .fn()
      .mockResolvedValueOnce('initial-token')
      .mockResolvedValueOnce('refreshed-token');
    const session = authSession({ getIdToken });
    configureApiAuthSession(session);
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response(401, {
          success: false,
          error: {
            code: 'AUTH_TOKEN_EXPIRED',
            message: 'private',
            details: {},
          },
        }),
      )
      .mockResolvedValueOnce(response(200, { success: true, data: {} }));

    await expect(api.dashboard.summary()).resolves.toEqual({});

    expect(getIdToken).toHaveBeenNthCalledWith(1, false);
    expect(getIdToken).toHaveBeenNthCalledWith(2, true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(
      new Headers(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).get(
        'authorization',
      ),
    ).toBe('Bearer initial-token');
    expect(
      new Headers(vi.mocked(fetch).mock.calls[1]?.[1]?.headers).get(
        'authorization',
      ),
    ).toBe('Bearer refreshed-token');
  });

  it('clears the session and returns a safe auth error when refresh fails', async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);
    const session = authSession({
      getIdToken: vi
        .fn()
        .mockResolvedValueOnce('initial-token')
        .mockRejectedValueOnce(new Error('FIREBASE_PRIVATE_KEY=secret')),
      clearSession,
    });
    configureApiAuthSession(session);
    vi.mocked(fetch).mockResolvedValueOnce(
      response(401, {
        success: false,
        error: { code: 'AUTH_TOKEN_EXPIRED', message: 'private', details: {} },
      }),
    );

    await expect(api.dashboard.summary()).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiClientError &&
        error.code === 'AUTH_TOKEN_EXPIRED' &&
        !error.message.includes('FIREBASE_PRIVATE_KEY'),
    );
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps temporary network failures separate from session invalidation', async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);
    const session = authSession({ clearSession });
    configureApiAuthSession(session);
    vi.mocked(fetch).mockRejectedValueOnce(
      new TypeError('http://192.168.1.42:3000'),
    );

    await expect(api.dashboard.summary()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(clearSession).not.toHaveBeenCalled();
  });
});
