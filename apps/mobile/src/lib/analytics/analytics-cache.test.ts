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
    replace: async (from, to) => {
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
    now = 3_000;
    await cache.write('user-a', 'insights-week', { total: 30 });

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
      value: { total: 30 },
      updatedAt: 3_000,
      stale: false,
    });
    expect(storage.files.has('user-a/insights-week.json.staged')).toBe(false);
  });

  it('preserves the committed entry when staging fails', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });

    await cache.write('user-a', 'insights-week', { total: 10 });
    const write = storage.write;
    storage.write = async (path, value) => {
      if (path.endsWith('.staged')) throw new Error('staged write failed');
      await write(path, value);
    };

    await expect(
      cache.write('user-a', 'insights-week', { total: 20 }),
    ).rejects.toThrow('staged write failed');
    await expect(
      cache.read(
        'user-a',
        'insights-week',
        (value): value is { total: number } =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { total?: unknown }).total === 'number',
      ),
    ).resolves.toMatchObject({ value: { total: 10 } });
  });

  it('preserves the committed entry when replacement fails', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });

    await cache.write('user-a', 'insights-week', { total: 10 });
    storage.replace = async () => {
      throw new Error('atomic replacement failed');
    };

    await expect(
      cache.write('user-a', 'insights-week', { total: 20 }),
    ).rejects.toThrow('atomic replacement failed');
    await expect(
      cache.read(
        'user-a',
        'insights-week',
        (value): value is { total: number } =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { total?: unknown }).total === 'number',
      ),
    ).resolves.toMatchObject({ value: { total: 10 } });
    expect(storage.files.has('user-a/insights-week.json')).toBe(true);
  });

  it('purges committed and staged entries without crossing encoded user partitions', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) =>
        `analytics/${encodeURIComponent(userId)}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });

    await cache.write('user/a', 'insights-week', { total: 10 });
    storage.files.set('analytics/user%2Fa/insights-week.json.staged', 'staged');
    await cache.write('other-user', 'insights-week', { total: 20 });

    await cache.purge('user/a', ['insights-week']);

    expect([...storage.files.keys()]).toEqual([
      'analytics/other-user/insights-week.json',
    ]);
  });

  it('reads and validates entries for UIDs with filesystem-significant characters', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) =>
        `analytics/${encodeURIComponent(userId)}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });
    const userId = 'uid/../other?value#fragment';

    await cache.write(userId, 'insights-week', { total: 10 });

    await expect(
      cache.read(
        userId,
        'insights-week',
        (value): value is { total: number } =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { total?: unknown }).total === 'number',
      ),
    ).resolves.toMatchObject({ value: { total: 10 } });
    expect([...storage.files.keys()]).toEqual([
      `analytics/${encodeURIComponent(userId)}/insights-week.json`,
    ]);
  });

  it('serializes concurrent writes for the same user and key and commits the latest value', async () => {
    const storage = memoryStorage();
    const originalWrite = storage.write;
    let releaseFirstStage!: () => void;
    let firstStageStarted!: () => void;
    const firstStage = new Promise<void>((resolve) => {
      firstStageStarted = resolve;
    });
    const firstStageRelease = new Promise<void>((resolve) => {
      releaseFirstStage = resolve;
    });
    let activeStages = 0;
    let maxActiveStages = 0;
    storage.write = async (path, value) => {
      if (path.endsWith('.staged')) {
        activeStages += 1;
        maxActiveStages = Math.max(maxActiveStages, activeStages);
        if (activeStages === 1) {
          firstStageStarted();
          await firstStageRelease;
        }
        activeStages -= 1;
      }
      await originalWrite(path, value);
    };
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });

    const first = cache.write('user-a', 'insights-week', { total: 10 });
    await firstStage;
    const second = cache.write('user-a', 'insights-week', { total: 20 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(maxActiveStages).toBe(1);
    releaseFirstStage();
    await Promise.all([first, second]);

    await expect(
      cache.read(
        'user-a',
        'insights-week',
        (value): value is { total: number } =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { total?: unknown }).total === 'number',
      ),
    ).resolves.toMatchObject({ value: { total: 20 } });
  });

  it('allows different users and keys to write independently', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });

    await Promise.all([
      cache.write('user-a', 'insights-week', { total: 10 }),
      cache.write('user-a', 'insights-month', { total: 20 }),
      cache.write('user-b', 'insights-week', { total: 30 }),
    ]);

    expect([...storage.files.keys()].sort()).toEqual([
      'user-a/insights-month.json',
      'user-a/insights-week.json',
      'user-b/insights-week.json',
    ]);
  });

  it('serializes three concurrent same-key writes without staged collisions', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });

    await expect(
      Promise.all([
        cache.write('user-a', 'insights-week', { total: 10 }),
        cache.write('user-a', 'insights-week', { total: 20 }),
        cache.write('user-a', 'insights-week', { total: 30 }),
      ]),
    ).resolves.toEqual([undefined, undefined, undefined]);
    expect(
      JSON.parse(storage.files.get('user-a/insights-week.json')!),
    ).toMatchObject({ value: { total: 30 } });
  });

  it('continues a queued write after an earlier same-key write fails', async () => {
    const storage = memoryStorage();
    const originalWrite = storage.write;
    let shouldFail = true;
    storage.write = async (path, value) => {
      if (shouldFail && path.endsWith('.staged')) {
        shouldFail = false;
        throw new Error('first staged write failed');
      }
      await originalWrite(path, value);
    };
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });

    const first = cache.write('user-a', 'insights-week', { total: 10 });
    const second = cache.write('user-a', 'insights-week', { total: 20 });

    await expect(first).rejects.toThrow('first staged write failed');
    await expect(second).resolves.toBeUndefined();
    expect(storage.files.get('user-a/insights-week.json')).toEqual(
      expect.any(String),
    );
  });

  it('ignores orphan staged data and never commits invalid staged contents', async () => {
    const storage = memoryStorage();
    const cache = createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `${userId}/${key}.json`,
      now: () => 1_000,
      staleAfterMs: 500,
    });
    await cache.write('user-a', 'insights-week', { total: 10 });
    storage.files.set('user-a/insights-week.json.staged', '{not-json');

    await expect(
      cache.read(
        'user-a',
        'insights-week',
        (value): value is { total: number } =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { total?: unknown }).total === 'number',
      ),
    ).resolves.toMatchObject({ value: { total: 10 } });
    expect(storage.files.get('user-a/insights-week.json.staged')).toBe(
      '{not-json',
    );
  });
});
