import { describe, expect, it } from 'vitest';
import { identitySyncFailureCategory } from '../src/middleware/firebase-auth.js';

describe('authentication diagnostic categories', () => {
  it.each([
    [{ code: 'P1001' }, 'database_unavailable'],
    [{ code: 'P1000' }, 'database_authentication_failed'],
    [{ code: 'P2021' }, 'database_schema_unavailable'],
    [
      { name: 'PrismaClientInitializationError' },
      'database_initialization_failed',
    ],
    [{}, 'unknown_identity_sync_failure'],
  ] as const)(
    'classifies %o as %s without retaining exception text',
    (error, category) => {
      expect(identitySyncFailureCategory(error)).toBe(category);
    },
  );
});
