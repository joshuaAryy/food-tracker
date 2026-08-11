export interface AnalyticsCacheStorage {
  read(path: string): Promise<string | null>;
  write(path: string, value: string): Promise<void>;
  replace(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  purgeDirectory(path: string): Promise<void>;
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
  purge(userId: string): Promise<void>;
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
  userDirectoryFor?: (userId: string) => string;
  now(): number;
  staleAfterMs: number;
}): AnalyticsCache {
  const pathFor = input.pathFor;
  const userDirectoryFor =
    input.userDirectoryFor ??
    ((userId: string) => {
      const path = pathFor(userId, '');
      const slashIndex = path.lastIndexOf('/');
      return slashIndex >= 0 ? path.slice(0, slashIndex + 1) : path;
    });
  const pendingWrites = new Map<string, Promise<void>>();
  const userStates = new Map<
    string,
    {
      generation: number;
      activeWrites: Set<Promise<void>>;
      purgePromise: Promise<void> | null;
    }
  >();

  const stateFor = (userId: string) => {
    const existing = userStates.get(userId);
    if (existing !== undefined) return existing;
    const state = {
      generation: 0,
      activeWrites: new Set<Promise<void>>(),
      purgePromise: null,
    };
    userStates.set(userId, state);
    return state;
  };

  const releaseStateIfIdle = (userId: string) => {
    const state = userStates.get(userId);
    if (
      state !== undefined &&
      state.activeWrites.size === 0 &&
      state.purgePromise === null
    ) {
      userStates.delete(userId);
    }
  };

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
      const state = stateFor(userId);
      const generation = state.generation;
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
      const purgeBarrier = state.purgePromise ?? Promise.resolve();
      // Keep the fixed staged path safe while allowing unrelated cache keys to
      // continue independently.
      const current = Promise.all([previous, purgeBarrier])
        .catch(() => undefined)
        .then(async () => {
          if (state.generation !== generation) return;
          await input.storage.write(stagedPath, JSON.stringify(entry));
          await input.storage.replace(stagedPath, path);
        });
      pendingWrites.set(writeKey, current);
      state.activeWrites.add(current);
      try {
        await current;
      } finally {
        state.activeWrites.delete(current);
        if (pendingWrites.get(writeKey) === current) {
          pendingWrites.delete(writeKey);
        }
        releaseStateIfIdle(userId);
      }
    },
    async purge(userId) {
      const state = stateFor(userId);
      state.generation += 1;
      const previousPurge = state.purgePromise;
      const activeWrites = [...state.activeWrites];
      const purge = Promise.all([
        previousPurge ?? Promise.resolve(),
        ...activeWrites,
      ])
        .catch(() => undefined)
        .then(() => input.storage.purgeDirectory(userDirectoryFor(userId)))
        .finally(() => {
          if (state.purgePromise === purge) {
            state.purgePromise = null;
            releaseStateIfIdle(userId);
          }
        });
      state.purgePromise = purge;
      await purge;
    },
  };
}
