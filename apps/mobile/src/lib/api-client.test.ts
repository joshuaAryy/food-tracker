import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  File: class File {},
}));

import { api, ApiClientError } from './api-client';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function success(data: unknown = {}): Response {
  return response(200, { success: true, data });
}

function transientFailure(status: number): Response {
  return response(status, {
    success: false,
    error: {
      code: 'DATABASE_NOT_READY',
      message: 'private transient message',
      details: { retryable: true },
    },
  });
}

async function settleRetry<T>(promise: Promise<T>): Promise<T> {
  const observed = promise.then(
    (value) => value,
    (error: unknown) => {
      throw error;
    },
  );
  await vi.advanceTimersByTimeAsync(400);
  return observed;
}

describe('central API transient read retry policy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([502, 503, 504])(
    'retries a safe GET after HTTP %s and returns the successful result',
    async (status) => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(transientFailure(status))
        .mockResolvedValueOnce(success({ recovered: true }));

      await expect(settleRetry(api.dashboard.summary())).resolves.toEqual({
        recovered: true,
      });
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('retries a safe GET after a transport failure and returns the successful result', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce(success({ recovered: true }));

    await expect(settleRetry(api.dashboard.summary())).resolves.toEqual({
      recovered: true,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('surfaces the ordinary connection failure after the bounded read retry', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockRejectedValueOnce(new TypeError('network unavailable'));

    const result = api.dashboard.summary().then(
      () => null,
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(400);
    await expect(result).resolves.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404, 409, 422, 500])(
    'does not retry a safe GET after HTTP %s',
    async (status) => {
      vi.mocked(fetch).mockResolvedValueOnce(transientFailure(status));

      await expect(api.dashboard.summary()).rejects.toBeInstanceOf(
        ApiClientError,
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['POST', () => api.foodLogs.create({} as never)],
    ['PUT', () => api.foodLogs.update('food-log-id', {} as never)],
    ['PATCH', () => api.analytics.updatePreferences({} as never)],
    ['DELETE', () => api.foodLogs.delete('food-log-id')],
  ])(
    'does not retry a %s mutation after HTTP 502',
    async (_method, operation) => {
      vi.mocked(fetch).mockResolvedValueOnce(transientFailure(502));

      await expect(operation()).rejects.toBeInstanceOf(ApiClientError);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('does not retry a response schema failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(success(null));

    await expect(api.profile.get()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 200,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
