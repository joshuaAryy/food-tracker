export type StagingInsightsDiagnosticStatusClass = `${2 | 3 | 4 | 5}xx`;

export type StagingInsightsDiagnosticStage =
  | 'request_started'
  | 'fetch_response_received'
  | 'http_status_class'
  | 'response_text_read'
  | 'response_text_read_failed'
  | 'json_parse_succeeded'
  | 'json_parse_failed'
  | 'envelope_parse_succeeded'
  | 'envelope_parse_failed'
  | 'canonical_schema_parse_succeeded'
  | 'canonical_schema_parse_failed'
  | 'api_insights_resolved'
  | 'report_commit_dispatched'
  | 'report_failure_dispatched'
  | 'cache_read_started'
  | 'cache_read_succeeded'
  | 'cache_read_failed'
  | 'cache_write_started'
  | 'cache_write_succeeded'
  | 'cache_write_failed';

export interface StagingInsightsDiagnostic {
  stage: StagingInsightsDiagnosticStage;
  requestSequenceId: number;
  statusClass?: StagingInsightsDiagnosticStatusClass;
  errorCode?: string;
  cacheValueExists?: boolean;
  failureStage?: StagingInsightsDiagnosticStage;
}

interface DiagnosticDetails {
  [key: string]: unknown;
  status?: unknown;
  errorCode?: unknown;
  cacheValueExists?: unknown;
  failureStage?: unknown;
}

const diagnosticStages = new Set<string>([
  'request_started',
  'fetch_response_received',
  'http_status_class',
  'response_text_read',
  'response_text_read_failed',
  'json_parse_succeeded',
  'json_parse_failed',
  'envelope_parse_succeeded',
  'envelope_parse_failed',
  'canonical_schema_parse_succeeded',
  'canonical_schema_parse_failed',
  'api_insights_resolved',
  'report_commit_dispatched',
  'report_failure_dispatched',
  'cache_read_started',
  'cache_read_succeeded',
  'cache_read_failed',
  'cache_write_started',
  'cache_write_succeeded',
  'cache_write_failed',
]);

function statusClass(
  status: unknown,
): StagingInsightsDiagnosticStatusClass | undefined {
  if (typeof status !== 'number' || !Number.isInteger(status)) return undefined;
  const value = Math.floor(status / 100);
  if (value === 2) return '2xx';
  if (value === 3) return '3xx';
  if (value === 4) return '4xx';
  if (value === 5) return '5xx';
  return undefined;
}

function safeErrorCode(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 64 ||
    !/^[A-Z0-9_-]+$/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function safeFailureStage(
  value: unknown,
): StagingInsightsDiagnosticStage | undefined {
  return typeof value === 'string' && diagnosticStages.has(value)
    ? (value as StagingInsightsDiagnosticStage)
    : undefined;
}

export function createStagingInsightsDiagnostic(
  environment: string,
  stage: StagingInsightsDiagnosticStage,
  requestSequenceId: number,
  details: DiagnosticDetails = {},
): StagingInsightsDiagnostic | null {
  if (environment !== 'staging') return null;
  const diagnostic: StagingInsightsDiagnostic = {
    stage,
    requestSequenceId,
  };
  const responseStatusClass = statusClass(details.status);
  const errorCode = safeErrorCode(details.errorCode);
  const failureStage = safeFailureStage(details.failureStage);
  if (responseStatusClass !== undefined) {
    diagnostic.statusClass = responseStatusClass;
  }
  if (errorCode !== undefined) diagnostic.errorCode = errorCode;
  if (typeof details.cacheValueExists === 'boolean') {
    diagnostic.cacheValueExists = details.cacheValueExists;
  }
  if (failureStage !== undefined) diagnostic.failureStage = failureStage;
  return diagnostic;
}

export function formatStagingInsightsDiagnostic(
  diagnostic: StagingInsightsDiagnostic,
): string {
  if (diagnostic.stage === 'report_commit_dispatched') {
    return 'Diagnostic: api_insights_resolved · report_commit_dispatched';
  }
  const parts = [
    diagnostic.failureStage ?? diagnostic.stage,
    diagnostic.statusClass,
    diagnostic.errorCode,
    diagnostic.cacheValueExists === undefined
      ? undefined
      : `cache ${diagnostic.cacheValueExists ? 'yes' : 'no'}`,
    diagnostic.stage === 'report_failure_dispatched'
      ? `request ${diagnostic.requestSequenceId}`
      : undefined,
    diagnostic.stage === 'report_failure_dispatched'
      ? 'report_failure_dispatched'
      : undefined,
  ].filter((part): part is string => part !== undefined);
  return `Diagnostic: ${parts.join(' · ')}`;
}
