export interface AnalyticsCacheStorage {
  read(path: string): Promise<string | null>;
  write(path: string, value: string): Promise<void>;
  replace(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

interface AnalyticsCacheEntry {
  version: 1;
  userId: string;
  key: string;
  updatedAt: number;
  value: unknown;
}

export interface AnalyticsCache {
  read<T>(
    userId: string,
    key: string,
    isValue: (value: unknown) => value is T,
  ): Promise<{ value: T; updatedAt: number; stale: boolean } | null>;
  write<T>(userId: string, key: string, value: T): Promise<void>;
  purge(userId: string, keys: readonly string[]): Promise<void>;
}

function cacheEntry(value: unknown): AnalyticsCacheEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Partial<AnalyticsCacheEntry>;
  return entry.version === 1 &&
    typeof entry.userId === 'string' &&
    typeof entry.key === 'string' &&
    typeof entry.updatedAt === 'number' &&
    Number.isFinite(entry.updatedAt) &&
    'value' in entry
    ? (entry as AnalyticsCacheEntry)
    : null;
}

export function createAnalyticsCache(input: {
  storage: AnalyticsCacheStorage;
  pathFor(userId: string, key: string): string;
  now(): number;
  staleAfterMs: number;
}): AnalyticsCache {
  const pathFor = input.pathFor;
  const pendingWrites = new Map<string, Promise<void>>();
  return {
    async read<T>(
      userId: string,
      key: string,
      isValue: (value: unknown) => value is T,
    ): Promise<{ value: T; updatedAt: number; stale: boolean } | null> {
      const path = pathFor(userId, key);
      const raw = await input.storage.read(path);
      if (raw === null) return null;
      try {
        const entry = cacheEntry(JSON.parse(raw));
        if (
          entry === null ||
          entry.userId !== userId ||
          entry.key !== key ||
          !isValue(entry.value)
        ) {
          await input.storage.remove(path);
          return null;
        }
        return {
          value: entry.value,
          updatedAt: entry.updatedAt,
          stale: input.now() - entry.updatedAt > input.staleAfterMs,
        };
      } catch {
        await input.storage.remove(path);
        return null;
      }
    },
    async write<T>(userId: string, key: string, value: T): Promise<void> {
      const path = pathFor(userId, key);
      const stagedPath = `${path}.staged`;
      const entry: AnalyticsCacheEntry = {
        version: 1,
        userId,
        key,
        updatedAt: input.now(),
        value,
      };
      const writeKey = `${userId}\u0000${key}`;
      const previous = pendingWrites.get(writeKey) ?? Promise.resolve();
      // Keep the fixed staged path safe while allowing unrelated cache keys to
      // continue independently.
      const current = previous
        .catch(() => undefined)
        .then(async () => {
          await input.storage.write(stagedPath, JSON.stringify(entry));
          await input.storage.replace(stagedPath, path);
        });
      pendingWrites.set(writeKey, current);
      try {
        await current;
      } finally {
        if (pendingWrites.get(writeKey) === current) {
          pendingWrites.delete(writeKey);
        }
      }
    },
    async purge(userId, keys) {
      await Promise.all(
        keys.map(async (key) => {
          await input.storage.remove(pathFor(userId, key));
          await input.storage.remove(`${pathFor(userId, key)}.staged`);
        }),
      );
    },
  };
}
