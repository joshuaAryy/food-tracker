import { describe, expect, it } from 'vitest';
import {
  createStagingInsightsDiagnostic,
  formatStagingInsightsDiagnostic,
} from './staging-insights-diagnostics';

describe('staging Insights diagnostics', () => {
  it('only creates sanitized diagnostics for the staging runtime', () => {
    expect(
      createStagingInsightsDiagnostic(
        'staging',
        'report_failure_dispatched',
        7,
        {
          status: 200,
          errorCode: 'INVALID_RESPONSE',
          cacheValueExists: true,
          failureStage: 'canonical_schema_parse_failed',
          responseBody: '{"private":"data"}',
          token: 'secret-token',
        },
      ),
    ).toEqual({
      stage: 'report_failure_dispatched',
      requestSequenceId: 7,
      statusClass: '2xx',
      errorCode: 'INVALID_RESPONSE',
      cacheValueExists: true,
      failureStage: 'canonical_schema_parse_failed',
    });
    expect(
      createStagingInsightsDiagnostic(
        'development',
        'report_failure_dispatched',
        7,
      ),
    ).toBeNull();
  });

  it('formats a failure with only the safe boundary metadata', () => {
    expect(
      formatStagingInsightsDiagnostic({
        stage: 'report_failure_dispatched',
        requestSequenceId: 7,
        statusClass: '2xx',
        errorCode: 'INVALID_RESPONSE',
        cacheValueExists: true,
        failureStage: 'canonical_schema_parse_failed',
      }),
    ).toBe(
      'Diagnostic: canonical_schema_parse_failed · 2xx · INVALID_RESPONSE · cache yes · request 7 · report_failure_dispatched',
    );
  });
});
