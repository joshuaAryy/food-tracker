import { emitServerDiagnostic } from '../../../lib/diagnostics.js';
import type { AnalyticsMetricKey } from '@food-tracker/shared';

export type InsightsPeriod = 'week' | 'month';
export type InsightsTrackingMode = 'simple' | 'complex';

export type InsightsDiagnosticCategory =
  | 'insights_route_started'
  | 'insights_tracking_mode_started'
  | 'insights_tracking_mode_succeeded'
  | 'insights_tracking_mode_failed'
  | 'insights_context_started'
  | 'insights_context_succeeded'
  | 'insights_context_failed'
  | 'insights_metric_started'
  | 'insights_metric_succeeded'
  | 'insights_metric_failed'
  | 'insights_computation_succeeded'
  | 'insights_response_send_started'
  | 'insights_response_send_succeeded'
  | 'insights_response_send_failed';

export interface InsightsDiagnosticDetails {
  requestId: string | undefined;
  period: InsightsPeriod;
  trackingMode?: InsightsTrackingMode;
  metric?: AnalyticsMetricKey;
  errorName?: string;
  errorCode?: string;
  errorMessage?: string;
  errorLocation?: string;
}

const MAX_ERROR_MESSAGE_LENGTH = 240;

function isStaging(environment: Record<string, string | undefined>): boolean {
  return environment.APP_ENV?.trim().toLowerCase() === 'staging';
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, '[redacted-token]')
    .replace(/Authorization\s*[:=]\s*\S+/gi, '[redacted-header]')
    .replace(/(?:https?|postgres(?:ql)?):\/\/\S+/gi, '[redacted-url]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .replace(
      /\b(?:uid|userId|email|foodName|nutrient|databaseUrl|password|token)\s*[:=]\s*("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^,\s}]+)/gi,
      '[redacted]',
    )
    .replace(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function firstApplicationFrame(stack: string | undefined): string | undefined {
  if (stack === undefined) return undefined;

  for (const line of stack.split('\n')) {
    const match = line.match(
      /(?:^|\/)(apps\/api\/(?:src|dist)\/[^():\s]+):(\d+)(?::\d+)?\)?$/,
    );
    if (match === null || match[1] === undefined || match[2] === undefined) {
      continue;
    }
    return `${match[1]
      .replace('/dist/', '/src/')
      .replace(/\.(?:m?js)$/i, '.ts')}:${match[2]}`;
  }
  return undefined;
}

function diagnosticErrorDetails(
  error: unknown,
): Pick<
  InsightsDiagnosticDetails,
  'errorName' | 'errorCode' | 'errorMessage' | 'errorLocation'
> {
  if (!(error instanceof Error)) return { errorName: 'unknown' };

  const code = (error as { code?: unknown }).code;
  const details: Pick<
    InsightsDiagnosticDetails,
    'errorName' | 'errorCode' | 'errorMessage' | 'errorLocation'
  > = {
    errorName: error.name || 'Error',
    errorMessage: redactSensitiveText(error.message),
  };
  if (typeof code === 'string') details.errorCode = code;
  const location = firstApplicationFrame(error.stack);
  if (location !== undefined) details.errorLocation = location;
  return details;
}

export function emitInsightsDiagnostic(
  category: InsightsDiagnosticCategory,
  details: InsightsDiagnosticDetails,
  environment: Record<string, string | undefined> = process.env,
): void {
  if (!isStaging(environment)) return;

  emitServerDiagnostic(category, {
    operation: 'analytics_insights',
    ...details,
  });
}

export function insightsDiagnosticErrorDetails(
  error: unknown,
): Pick<
  InsightsDiagnosticDetails,
  'errorName' | 'errorCode' | 'errorMessage' | 'errorLocation'
> {
  return diagnosticErrorDetails(error);
}

export function insightsDiagnosticsEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return isStaging(environment);
}
