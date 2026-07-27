import {
  AuthBoundaryError,
  type FirebaseAdminAuthAdapter,
  type FirebaseAdminUserStatus,
  type FirebaseRevocationStatusService,
  type VerifiedFirebaseIdentity,
} from './types.js';

export { AuthBoundaryError } from './types.js';
export type {
  FirebaseAdminAuthAdapter,
  FirebaseAdminUserStatus,
  FirebaseRevocationStatusService,
  VerifiedFirebaseIdentity,
} from './types.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 10_000;

export interface FirebaseRevocationStatusOptions {
  now?: () => number;
  ttlMs?: number;
  maxEntries?: number;
}

type CacheEntry = { expiresAt: number };

function epochSeconds(value: string | number | Date | null): number {
  if (value === null) return 0;

  if (value instanceof Date) {
    const milliseconds = value.getTime();
    if (Number.isFinite(milliseconds)) return Math.floor(milliseconds / 1000);
  } else {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Math.floor(numeric < 1_000_000_000_000 ? numeric : numeric / 1000);
    }
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }

  throw new AuthBoundaryError('AUTH_CONFIGURATION_ERROR');
}

function pruneExpired(cache: Map<string, CacheEntry>, now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
}

function evictOldest(cache: Map<string, CacheEntry>, maxEntries: number): void {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) return;
    cache.delete(oldestKey);
  }
}

export function createFirebaseRevocationStatusService(
  adapter: FirebaseAdminAuthAdapter,
  options: FirebaseRevocationStatusOptions = {},
): FirebaseRevocationStatusService {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
  const cache = new Map<string, CacheEntry>();

  return {
    async assertActive(identity: VerifiedFirebaseIdentity) {
      const currentTime = now();
      pruneExpired(cache, currentTime);
      const cacheKey = `${identity.uid}:${identity.authenticatedAt}`;
      const cached = cache.get(cacheKey);
      if (cached !== undefined && cached.expiresAt > currentTime) return;
      if (cached !== undefined) cache.delete(cacheKey);

      let status: FirebaseAdminUserStatus;
      try {
        status = await adapter.getUser(identity.uid);
      } catch (cause) {
        throw new AuthBoundaryError('AUTH_TOKEN_REVOKED', { cause });
      }

      if (status.disabled) {
        throw new AuthBoundaryError('AUTH_TOKEN_REVOKED');
      }

      if (
        identity.authenticatedAt <= epochSeconds(status.tokensValidAfterTime)
      ) {
        throw new AuthBoundaryError('AUTH_TOKEN_REVOKED');
      }

      cache.set(cacheKey, { expiresAt: currentTime + ttlMs });
      evictOldest(cache, maxEntries);
    },
  };
}
