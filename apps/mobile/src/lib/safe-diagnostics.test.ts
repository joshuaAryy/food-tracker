import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createSafeDiagnostic } from './safe-diagnostics';

function productionMobileFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return productionMobileFiles(path);
    if (!/\.(ts|tsx)$/.test(path) || /\.test\.(ts|tsx)$/.test(path)) {
      return [];
    }
    return path.endsWith('/safe-diagnostics.ts') ? [] : [path];
  });
}

describe('mobile diagnostic boundary', () => {
  it('keeps direct console calls out of production mobile source', () => {
    const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const violations = productionMobileFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return /\bconsole\.(log|warn|error)\s*\(/.test(source)
        ? [relative(sourceRoot, path)]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it('keeps hosts, paths, credentials, PII, and raw errors out of diagnostics', () => {
    expect(
      createSafeDiagnostic('request_failed', {
        status: 503,
        operation: 'photo_analysis',
        url: 'http://192.168.1.42:3000/api/v1/ai/photo-parse',
        apiHost: '192.168.1.42:3000',
        endpoint: '/api/v1/ai/photo-parse',
        authorization: 'Bearer test-secret-token',
        email: 'service-account@example.iam.gserviceaccount.com',
        userId: 'application-user-id',
        errorMessage: 'DATABASE_URL=postgresql://user:password@host/database',
      }),
    ).toEqual({
      category: 'request_failed',
      statusClass: '5xx',
      operation: 'photo_analysis',
    });
  });
});
