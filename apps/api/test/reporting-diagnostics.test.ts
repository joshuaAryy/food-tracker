import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseReportsWithDiagnostics,
  runReportsComputeWithDiagnostics,
  sendReportsWithDiagnostics,
} from '../src/modules/analytics/reporting/route-diagnostics.js';

function diagnosticCalls(warn: { mock: { calls: unknown[][] } }) {
  return warn.mock.calls
    .filter((call) => call[0] === '[food-tracker:diagnostic]')
    .map((call) => call[1] as Record<string, unknown>);
}

describe('Reports route diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rethrows compute failures with a safe boundary diagnostic', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error(
      'private@example.com DATABASE_URL=postgresql://user:password@host/db',
    );

    await expect(
      runReportsComputeWithDiagnostics(
        () => Promise.reject(error),
        'req_reports_compute_test',
      ),
    ).rejects.toBe(error);

    const diagnostics = diagnosticCalls(warn);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'reports_compute_started',
          operation: 'analytics_reports_compute',
          requestId: 'req_reports_compute_test',
        }),
        expect.objectContaining({
          category: 'reports_compute_failed',
          operation: 'analytics_reports_compute',
          requestId: 'req_reports_compute_test',
          errorClass: 'Error',
          errorCategory: 'exception',
        }),
      ]),
    );
    expect(JSON.stringify(diagnostics)).not.toContain('private@example.com');
    expect(JSON.stringify(diagnostics)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(diagnostics)).not.toContain('password');
    expect(JSON.stringify(diagnostics)).not.toContain('stack');
  });

  it('distinguishes schema failures and emits only sanitized Zod paths', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const schema = z.object({
      current: z.object({ title: z.string() }),
    });

    expect(() =>
      parseReportsWithDiagnostics(
        () => schema.parse({ current: { title: 42 } }),
        'req_reports_schema_test',
      ),
    ).toThrow();

    const diagnostics = diagnosticCalls(warn);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'reports_schema_validation_started',
          operation: 'analytics_reports_schema_validation',
          requestId: 'req_reports_schema_test',
        }),
        expect.objectContaining({
          category: 'reports_schema_validation_failed',
          operation: 'analytics_reports_schema_validation',
          requestId: 'req_reports_schema_test',
          errorClass: 'ZodError',
          errorCategory: 'schema_validation',
          invalidFieldPaths: [['current', 'title']],
        }),
      ]),
    );
    expect(JSON.stringify(diagnostics)).not.toContain('42');
    expect(JSON.stringify(diagnostics)).not.toContain('ZodError:');
  });

  it('keeps successful schema parsing and response sending unchanged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const parsed = parseReportsWithDiagnostics(
      () => ({ ok: true as const }),
      'req_reports_success_test',
    );
    let sent = false;

    sendReportsWithDiagnostics(() => {
      sent = true;
    }, 'req_reports_success_test');

    expect(parsed).toEqual({ ok: true });
    expect(sent).toBe(true);
    expect(diagnosticCalls(warn)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'reports_schema_validation_succeeded',
        }),
        expect.objectContaining({
          category: 'reports_response_send_started',
        }),
        expect.objectContaining({
          category: 'reports_response_send_succeeded',
        }),
      ]),
    );
  });

  it('rethrows response-send failures with a safe boundary diagnostic', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('private response payload and stack details');

    expect(() =>
      sendReportsWithDiagnostics(() => {
        throw error;
      }, 'req_reports_send_test'),
    ).toThrow(error);

    const diagnostics = diagnosticCalls(warn);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'reports_response_send_failed',
          operation: 'analytics_reports_response_send',
          requestId: 'req_reports_send_test',
          errorClass: 'Error',
          errorCategory: 'exception',
        }),
      ]),
    );
    expect(JSON.stringify(diagnostics)).not.toContain('private response');
    expect(JSON.stringify(diagnostics)).not.toContain('stack details');
  });
});
