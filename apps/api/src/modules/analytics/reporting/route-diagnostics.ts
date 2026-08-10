import { ZodError } from 'zod';
import { emitServerDiagnostic } from '../../../lib/diagnostics.js';

type ReportsDiagnosticContext = {
  requestId?: string | undefined;
};

function errorDetails(
  error: unknown,
  context: ReportsDiagnosticContext,
): Record<string, unknown> {
  const details: Record<string, unknown> = {
    requestId: context.requestId,
    errorClass: error instanceof Error ? error.constructor.name : 'unknown',
    errorCategory: error instanceof Error ? 'exception' : 'unknown',
  };

  if (error instanceof ZodError) {
    details.errorCategory = 'schema_validation';
    details.invalidFieldPaths = error.issues.map((issue) =>
      issue.path.map(String),
    );
  }

  return details;
}

export async function runReportsComputeWithDiagnostics<T>(
  compute: () => Promise<T>,
  requestId?: string,
): Promise<T> {
  const context = { requestId };
  emitServerDiagnostic('reports_compute_started', {
    operation: 'analytics_reports_compute',
    ...context,
  });

  try {
    const result = await compute();
    emitServerDiagnostic('reports_compute_succeeded', {
      operation: 'analytics_reports_compute',
      ...context,
    });
    return result;
  } catch (error) {
    emitServerDiagnostic('reports_compute_failed', {
      operation: 'analytics_reports_compute',
      ...context,
      ...errorDetails(error, context),
    });
    throw error;
  }
}

export function parseReportsWithDiagnostics<T>(
  parse: () => T,
  requestId?: string,
): T {
  const context = { requestId };
  emitServerDiagnostic('reports_schema_validation_started', {
    operation: 'analytics_reports_schema_validation',
    ...context,
  });

  try {
    const result = parse();
    emitServerDiagnostic('reports_schema_validation_succeeded', {
      operation: 'analytics_reports_schema_validation',
      ...context,
    });
    return result;
  } catch (error) {
    emitServerDiagnostic('reports_schema_validation_failed', {
      operation: 'analytics_reports_schema_validation',
      ...context,
      ...errorDetails(error, context),
    });
    throw error;
  }
}

export function sendReportsWithDiagnostics(
  send: () => void,
  requestId?: string,
): void {
  const context = { requestId };
  emitServerDiagnostic('reports_response_send_started', {
    operation: 'analytics_reports_response_send',
    ...context,
  });

  try {
    send();
    emitServerDiagnostic('reports_response_send_succeeded', {
      operation: 'analytics_reports_response_send',
      ...context,
    });
  } catch (error) {
    emitServerDiagnostic('reports_response_send_failed', {
      operation: 'analytics_reports_response_send',
      ...context,
      ...errorDetails(error, context),
    });
    throw error;
  }
}
