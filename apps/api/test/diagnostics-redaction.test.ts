import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createServerDiagnostic,
  emitServerDiagnostic,
} from '../src/lib/diagnostics.js';

function productionApiFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return productionApiFiles(path);
    if (!path.endsWith('.ts') || path.endsWith('.test.ts')) return [];
    return path.endsWith('/diagnostics.ts') ? [] : [path];
  });
}

describe('server diagnostic boundary', () => {
  it('keeps infrastructure, credentials, PII, provider data, and exceptions out', () => {
    expect(
      createServerDiagnostic('request_failed', {
        status: 503,
        operation: 'food_parse',
        requestId: 'req_opaque_123',
        url: 'https://internal-service.railway.internal/api/v1/ai/food-parse',
        authorization: 'Bearer test-secret-token',
        email: 'service-account@example.iam.gserviceaccount.com',
        databaseUrl: 'DATABASE_URL=postgresql://user:password@host/database',
        providerBody: '{"error":"upstream response"}',
        providerMessage: 'Gemini generateContent failed',
        sql: 'SELECT * FROM "User"',
        stack: '/Users/joshua/food_tracker/apps/api/src/server.ts',
        error: new Error('raw exception'),
      }),
    ).toEqual({
      category: 'request_failed',
      requestId: 'req_opaque_123',
      status: 503,
      statusClass: '5xx',
      operation: 'food_parse',
    });
  });

  it('keeps bounded provider metadata and preserves the safe diagnostic scope', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    emitServerDiagnostic(
      'provider_optional_region_discarded',
      {
        analysisId: 'analysis-test-id',
        itemIndex: 0,
        violationCategories: ['above_one'],
        invalidFieldPaths: [['width']],
        providerMessage: 'Gemini generateContent failed',
        providerBody: '{"meal":"private data"}',
      },
      'photo-analysis:provider',
    );

    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:provider]',
      expect.objectContaining({
        category: 'provider_optional_region_discarded',
        analysisId: 'analysis-test-id',
        itemIndex: 0,
        violationCategories: ['above_one'],
        invalidFieldPaths: [['width']],
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Gemini');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private data');
    warn.mockRestore();
  });

  it('keeps direct console calls out of API production source', () => {
    const sourceRoot = join(import.meta.dirname, '..', 'src');
    const violations = productionApiFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return /\bconsole\.(log|warn|error)\s*\(/.test(source)
        ? [relative(sourceRoot, path)]
        : [];
    });

    expect(violations).toEqual([]);
  });
});
