import type { ApiResponse } from '@food-tracker/shared';

export interface ResponseSchema<T> {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidResponse(
  status: number,
): Error & { code: string; status: number } {
  const error = new Error(
    'The API returned an unreadable or unexpected response.',
  ) as Error & {
    code: string;
    status: number;
  };
  error.name = 'ApiClientError';
  error.code = 'INVALID_RESPONSE';
  error.status = status;
  return error;
}

export async function parseApiResponse<T>(
  response: Response,
  schema?: ResponseSchema<T>,
  onDiagnostic?: (event: string, details: Record<string, unknown>) => void,
  onError?: (input: {
    response: Response;
    error: Record<string, unknown>;
  }) => Error,
): Promise<T> {
  const responseText = await response.text();
  onDiagnostic?.('response_received', {
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'missing',
    bodyByteLength: new TextEncoder().encode(responseText).byteLength,
  });

  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    onDiagnostic?.('response_json_parse_failed', {
      status: response.status,
    });
    throw invalidResponse(response.status);
  }

  if (!isRecord(payload) || typeof payload.success !== 'boolean') {
    onDiagnostic?.('response_envelope_parse_failed', {
      status: response.status,
    });
    throw invalidResponse(response.status);
  }

  const envelope = payload as unknown as ApiResponse<unknown>;
  if (!envelope.success) {
    if (
      !isRecord(envelope.error) ||
      typeof envelope.error.code !== 'string' ||
      typeof envelope.error.message !== 'string' ||
      !isRecord(envelope.error.details)
    ) {
      throw invalidResponse(response.status);
    }
    throw (
      onError?.({ response, error: envelope.error }) ??
      invalidResponse(response.status)
    );
  }
  if (!response.ok) throw invalidResponse(response.status);
  if (schema === undefined) return envelope.data as T;

  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) {
    onDiagnostic?.('response_schema_parse_failed', { status: response.status });
    throw invalidResponse(response.status);
  }
  onDiagnostic?.('response_schema_parsed', { status: response.status });
  return parsed.data;
}
