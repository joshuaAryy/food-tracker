import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabaseReadiness } from '../src/lib/database-readiness.js';

describe('health readiness endpoint', () => {
  it('keeps /health liveness-only when the database probe fails', async () => {
    const readiness = createDatabaseReadiness({
      probe: vi.fn().mockRejectedValue(new Error('database is unavailable')),
    });

    const response = await request(
      createApp((_request, _response, next) => next(), {
        databaseReadiness: readiness,
      }),
    ).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns ready when the shared database readiness probe succeeds', async () => {
    const readiness = createDatabaseReadiness({
      probe: vi.fn().mockResolvedValue(undefined),
    });

    const response = await request(
      createApp((_request, _response, next) => next(), {
        databaseReadiness: readiness,
      }),
    ).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
  });

  it('returns the controlled readiness failure when the shared probe is exhausted', async () => {
    let now = 0;
    const readiness = createDatabaseReadiness({
      probe: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('offline'), { code: 'P1001' }),
        ),
      now: () => now,
      sleep: async (delayMs) => {
        now += delayMs;
      },
    });

    const response = await request(
      createApp((_request, _response, next) => next(), {
        databaseReadiness: readiness,
      }),
    ).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('1');
    expect(response.body.error.code).toBe('DATABASE_NOT_READY');
  });

  it('places the readiness gate before the normal API authentication boundary', async () => {
    let attempts = 0;
    const readiness = createDatabaseReadiness({
      probe: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error('database waking'), { code: 'P1001' });
        }
      },
      sleep: async () => undefined,
    });
    const auth = vi.fn((_request, _response, next) => next());

    const response = await request(
      createApp(auth, { databaseReadiness: readiness }),
    ).get('/api/v1/not-a-route');

    expect(response.status).toBe(404);
    expect(attempts).toBe(2);
    expect(auth).toHaveBeenCalledTimes(1);
  });
});
