import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createOpaqueRateLimitKey,
  rateLimitKeySecret,
} from '../src/modules/ai/rate-limit-key.js';

describe('opaque rate-limit keys', () => {
  it('does not return the raw network identifier', () => {
    const rawAddress = '192.168.1.42';

    const key = createOpaqueRateLimitKey({
      userId: 'application-user-id',
      networkIdentifier: rawAddress,
      secret: 'test-rate-limit-secret',
    });

    expect(key).not.toContain(rawAddress);
    expect(key).not.toContain('application-user-id');
  });

  it('is stable for equivalent input and separates different input', () => {
    const first = createOpaqueRateLimitKey({
      userId: 'application-user-id',
      networkIdentifier: '192.168.1.42',
      secret: 'test-rate-limit-secret',
    });
    const equivalent = createOpaqueRateLimitKey({
      userId: 'application-user-id',
      networkIdentifier: '192.168.1.42',
      secret: 'test-rate-limit-secret',
    });
    const different = createOpaqueRateLimitKey({
      userId: 'application-user-id',
      networkIdentifier: '192.168.1.43',
      secret: 'test-rate-limit-secret',
    });

    expect(equivalent).toBe(first);
    expect(different).not.toBe(first);
  });

  it('normalizes missing or malformed network identifiers safely', () => {
    const missing = createOpaqueRateLimitKey({
      userId: 'application-user-id',
      networkIdentifier: undefined,
      secret: 'test-rate-limit-secret',
    });
    const malformed = createOpaqueRateLimitKey({
      userId: 'application-user-id',
      networkIdentifier: '\nAuthorization: Bearer test-secret-token',
      secret: 'test-rate-limit-secret',
    });

    expect(missing).toMatch(/^[a-f0-9]{64}$/);
    expect(malformed).toMatch(/^[a-f0-9]{64}$/);
    expect(malformed).not.toContain('test-secret-token');
  });

  it('keeps every application rate-limit callsite on the opaque-key boundary', () => {
    for (const routePath of [
      join(import.meta.dirname, '../src/modules/ai/routes.ts'),
      join(import.meta.dirname, '../src/modules/foodItems/routes.ts'),
    ]) {
      const source = readFileSync(routePath, 'utf8');
      expect(source).not.toMatch(/\$\{userId\}:\$\{request\.ip/);
    }
  });

  it('uses a deterministic local fallback and requires hosted key material', () => {
    expect(rateLimitKeySecret({ APP_ENV: 'development' })).toBe(
      rateLimitKeySecret({ APP_ENV: 'development' }),
    );
    expect(() => rateLimitKeySecret({ APP_ENV: 'production' })).toThrow(
      'RATE_LIMIT_KEY_SECRET',
    );
  });
});
