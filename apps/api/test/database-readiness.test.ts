import express from 'express';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../src/middleware/error-handler.js';
import {
  createDatabaseReadiness,
  isTransientDatabaseReadinessError,
} from '../src/lib/database-readiness.js';
import { createDatabaseReadinessMiddleware } from '../src/middleware/database-readiness.js';

function prismaError(code: string, message = code): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe('database request readiness', () => {
  it('probes once and continues immediately when the database is ready', async () => {
    const probe = vi.fn().mockResolvedValue(undefined);
    const readiness = createDatabaseReadiness({ probe });
    const handler = vi.fn((_request, response) => response.sendStatus(204));
    const app = express();
    app.use(createDatabaseReadinessMiddleware(readiness));
    app.get('/read', handler);

    const response = await request(app).get('/read');

    expect(response.status).toBe(204);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('retries only transient connectivity failures with bounded backoff', async () => {
    let now = 0;
    let attempts = 0;
    const delays: number[] = [];
    const readiness = createDatabaseReadiness({
      probe: async () => {
        attempts += 1;
        if (attempts < 3) throw prismaError('P1001');
      },
      now: () => now,
      sleep: async (delayMs) => {
        delays.push(delayMs);
        now += delayMs;
      },
    });

    await expect(readiness.ensureReady()).resolves.toBeUndefined();

    expect(attempts).toBe(3);
    expect(delays).toEqual([250, 500]);
  });

  it('does not retry non-transient Prisma failures', async () => {
    const probe = vi.fn().mockRejectedValue(prismaError('P2002'));
    const readiness = createDatabaseReadiness({
      probe,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    await expect(readiness.ensureReady()).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(probe).toHaveBeenCalledTimes(1);
    expect(isTransientDatabaseReadinessError(prismaError('P2002'))).toBe(false);
  });

  it('classifies Prisma 6.19 connectivity errors without classifying integrity errors', () => {
    expect(
      isTransientDatabaseReadinessError(
        new Prisma.PrismaClientInitializationError(
          "Can't reach database server",
          '6.19.2',
          'P1001',
        ),
      ),
    ).toBe(true);
    expect(
      isTransientDatabaseReadinessError(
        new Prisma.PrismaClientKnownRequestError('connection pool timeout', {
          code: 'P2024',
          clientVersion: '6.19.2',
        }),
      ),
    ).toBe(true);
    expect(
      isTransientDatabaseReadinessError(
        new Prisma.PrismaClientKnownRequestError('unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.2',
        }),
      ),
    ).toBe(false);
  });

  it('returns a controlled retryable failure after the recovery budget is exhausted', async () => {
    let now = 0;
    const readiness = createDatabaseReadiness({
      probe: async () => {
        throw prismaError('P1001');
      },
      now: () => now,
      sleep: async (delayMs) => {
        now += delayMs;
      },
    });
    const app = express();
    app.use(createDatabaseReadinessMiddleware(readiness));
    app.get(
      '/read',
      vi.fn((_request, response) => response.sendStatus(204)),
    );
    app.use(errorHandler);

    const response = await request(app).get('/read');

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('1');
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'DATABASE_NOT_READY',
        message: 'The database is temporarily unavailable. Please try again.',
        details: { retryable: true },
      },
    });
  });

  it('allows a mutation handler to execute exactly once after readiness recovers', async () => {
    let attempts = 0;
    const readiness = createDatabaseReadiness({
      probe: async () => {
        attempts += 1;
        if (attempts === 1) throw prismaError('P1001');
      },
      sleep: async () => undefined,
    });
    const handler = vi.fn((_request, response) =>
      response.json({ created: true }),
    );
    const app = express();
    app.use(createDatabaseReadinessMiddleware(readiness));
    app.post('/food-logs', handler);

    const response = await request(app).post('/food-logs').send({});

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(attempts).toBe(2);
  });

  it('shares one in-flight recovery sequence across concurrent requests', async () => {
    let releaseProbe!: () => void;
    const probe = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseProbe = resolve;
        }),
    );
    const readiness = createDatabaseReadiness({ probe });

    const first = readiness.ensureReady();
    const second = readiness.ensureReady();
    expect(probe).toHaveBeenCalledTimes(1);

    releaseProbe();
    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('caches readiness briefly and probes again after the cache expires', async () => {
    let now = 0;
    const probe = vi.fn().mockResolvedValue(undefined);
    const readiness = createDatabaseReadiness({
      probe,
      cacheMs: 100,
      now: () => now,
    });

    await readiness.ensureReady();
    await readiness.ensureReady();
    now = 101;
    await readiness.ensureReady();

    expect(probe).toHaveBeenCalledTimes(2);
  });
});
