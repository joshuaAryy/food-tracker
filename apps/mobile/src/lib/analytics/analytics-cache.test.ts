import { describe, expect, it } from 'vitest';
import {
  createAnalyticsCache,
  type AnalyticsCacheStorage,
} from './analytics-cache';

function memoryStorage(): AnalyticsCacheStorage & {
  files: Map<string, string>;
} {
  const files = new Map<string, string>();
  return {
    files,
    read: async (path) => files.get(path) ?? null,
    write: async (path, value) => {
      files.set(path, value);
    },
    move: async (from, to) => {
      const value = files.get(from);
      if (value === undefined) throw new Error('Missing staged cache file');
      files.set(to, value);
      files.delete(from);
    },
    remove: async (path) => {
      files.delete(path);
    },
  };
}

describe('analytics cache', () => {
  it('atomically writes validated, user-partitioned cache entries and reads stale state', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });

    await cache.write('user-a', 'insights-week', { total: 10 });

    await expect(
      cache.read(
        'user-a',
        'insights-week',
        (value): value is { total: number } =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { total?: unknown }).total === 'number',
      ),
    ).resolves.toEqual({
      value: { total: 10 },
      updatedAt: 1_000,
      stale: false,
    });
    await expect(
      cache.read(
        'user-b',
        'insights-week',
        (value): value is unknown => value !== undefined,
      ),
    ).resolves.toBeNull();
    expect([...storage.files]).toEqual([
      ['user-a/insights-week.json', expect.any(String)],
    ]);
  });

  it('rejects schema-mismatched cache data and purges only the requested user', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 2_000,
      staleAfterMs: 500,
    });
    await cache.write('user-a', 'trend', { total: 10 });
    await cache.write('user-b', 'trend', { total: 20 });

    await expect(
      cache.read(
        'user-a',
        'trend',
        (value): value is never => typeof value === 'symbol',
      ),
    ).resolves.toBeNull();
    await cache.purge('user-a', ['trend']);

    expect(storage.files.has('user-a/trend.json')).toBe(false);
    expect(storage.files.has('user-b/trend.json')).toBe(true);
  });

  it('replaces a committed entry through staging without retaining a stale staged file', async () => {
    const storage = memoryStorage();
    let now = 1_000;
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => now,
      staleAfterMs: 500,
    });

    await cache.write('user-a', 'insights-week', { total: 10 });
    now = 2_000;
    await cache.write('user-a', 'insights-week', { total: 20 });

    await expect(
      cache.read(
        'user-a',
        'insights-week',
        (value): value is { total: number } =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { total?: unknown }).total === 'number',
      ),
    ).resolves.toEqual({
      value: { total: 20 },
      updatedAt: 2_000,
      stale: false,
    });
    expect(storage.files.has('user-a/insights-week.json.staged')).toBe(false);
  });
});
