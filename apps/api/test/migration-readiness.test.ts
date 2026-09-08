import { describe, expect, it } from 'vitest';
import {
  isTransientDatabaseReadinessError,
  waitForDatabaseReady,
} from '../src/lib/migration-readiness.js';

describe('database migration readiness', () => {
  it('waits through transient database startup failures before succeeding', async () => {
    let now = 0;
    let attempts = 0;
    const delays: number[] = [];

    await waitForDatabaseReady({
      timeoutMs: 100,
      retryDelayMs: 25,
      now: () => now,
      sleep: async (delayMs) => {
        delays.push(delayMs);
        now += delayMs;
      },
      probe: async () => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error('FATAL: the database system is starting up');
          Object.assign(error, { errorCode: 'P1001' });
          throw error;
        }
      },
      log: () => undefined,
    });

    expect(attempts).toBe(3);
    expect(delays).toEqual([25, 25]);
  });

  it('does not retry non-readiness failures', async () => {
    let attempts = 0;
    const error = new Error('authentication failed for user');
    Object.assign(error, { errorCode: 'P1000' });

    await expect(
      waitForDatabaseReady({
        timeoutMs: 100,
        retryDelayMs: 25,
        probe: async () => {
          attempts += 1;
          throw error;
        },
        sleep: async () => undefined,
        log: () => undefined,
      }),
    ).rejects.toThrow('Database was not ready for migrations');

    expect(attempts).toBe(1);
    expect(isTransientDatabaseReadinessError(error)).toBe(false);
  });

  it('fails at the bounded deadline for a persistent startup failure', async () => {
    let now = 0;
    let attempts = 0;

    await expect(
      waitForDatabaseReady({
        timeoutMs: 60,
        retryDelayMs: 25,
        now: () => now,
        sleep: async (delayMs) => {
          now += delayMs;
        },
        probe: async () => {
          attempts += 1;
          const error = new Error('FATAL: the database system is starting up');
          Object.assign(error, { errorCode: 'P1001' });
          throw error;
        },
        log: () => undefined,
      }),
    ).rejects.toThrow('Database was not ready for migrations');

    expect(attempts).toBe(4);
    expect(now).toBe(60);
  });
});
