import { emitServerDiagnostic } from '../../../lib/diagnostics.js';

export type InsightsDiagnosticMetricKey =
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'macroComposition'
  | 'weight'
  | 'hydration'
  | 'loggingConsistency';

function errorDetails(
  error: unknown,
  requestId: string | undefined,
  field?: InsightsDiagnosticMetricKey,
): Record<string, unknown> {
  return {
    requestId,
    ...(field === undefined ? {} : { field }),
    errorClass: error instanceof Error ? error.constructor.name : 'unknown',
    errorCategory: error instanceof Error ? 'exception' : 'unknown',
  };
}

export function emitInsightsRequestStarted(requestId?: string): void {
  emitServerDiagnostic('insights_request_started', {
    requestId,
    operation: 'analytics_insights_request',
  });
}

export async function runInsightsTrackingModeWithDiagnostics<T>(
  lookup: () => Promise<T>,
  requestId?: string,
): Promise<T> {
  const context = { requestId, operation: 'analytics_insights_tracking_mode' };
  emitServerDiagnostic('insights_tracking_mode_started', context);
  try {
    const result = await lookup();
    emitServerDiagnostic('insights_tracking_mode_succeeded', context);
    return result;
  } catch (error) {
    emitServerDiagnostic('insights_tracking_mode_failed', {
      ...context,
      ...errorDetails(error, requestId),
    });
    throw error;
  }
}

export async function createInsightsContextWithDiagnostics<T>(
  create: () => T,
  waitUntilReady: (context: T) => Promise<unknown>,
  requestId?: string,
): Promise<T> {
  const diagnosticContext = {
    requestId,
    operation: 'analytics_insights_context',
  };
  emitServerDiagnostic('insights_context_started', diagnosticContext);
  try {
    const context = create();
    await waitUntilReady(context);
    emitServerDiagnostic('insights_context_succeeded', diagnosticContext);
    return context;
  } catch (error) {
    emitServerDiagnostic('insights_context_failed', {
      ...diagnosticContext,
      ...errorDetails(error, requestId),
    });
    throw error;
  }
}

export async function runInsightsMetricWithDiagnostics<T>(
  metric: InsightsDiagnosticMetricKey,
  compute: () => Promise<T>,
  requestId?: string,
): Promise<T> {
  const context = {
    requestId,
    operation: 'analytics_insights_metric',
    field: metric,
  };
  emitServerDiagnostic('insights_metric_started', context);
  try {
    const result = await compute();
    emitServerDiagnostic('insights_metric_succeeded', context);
    return result;
  } catch (error) {
    emitServerDiagnostic('insights_metric_failed', {
      ...context,
      ...errorDetails(error, requestId, metric),
    });
    throw error;
  }
}

export async function runInsightsComputationWithDiagnostics<T>(
  compute: () => Promise<T>,
  requestId?: string,
): Promise<T> {
  const context = {
    requestId,
    operation: 'analytics_insights_compute',
  };
  emitServerDiagnostic('insights_computation_started', context);
  try {
    const result = await compute();
    emitServerDiagnostic('insights_computation_succeeded', context);
    return result;
  } catch (error) {
    emitServerDiagnostic('insights_computation_failed', {
      ...context,
      ...errorDetails(error, requestId),
    });
    throw error;
  }
}

export function sendInsightsWithDiagnostics(
  send: () => void,
  requestId?: string,
): void {
  const context = {
    requestId,
    operation: 'analytics_insights_response_send',
  };
  emitServerDiagnostic('insights_response_send_started', context);
  try {
    send();
    emitServerDiagnostic('insights_response_send_succeeded', context);
  } catch (error) {
    emitServerDiagnostic('insights_response_send_failed', {
      ...context,
      ...errorDetails(error, requestId),
    });
    throw error;
  }
}
