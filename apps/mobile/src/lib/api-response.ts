import type { ApiResponse } from '@food-tracker/shared';

export interface ResponseSchema<T> {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false };
}

export type ResponseParseDiagnosticStage =
  | 'response_text_read'
  | 'response_text_read_failed'
  | 'json_parse_succeeded'
  | 'json_parse_failed'
  | 'envelope_parse_succeeded'
  | 'envelope_parse_failed'
  | 'canonical_schema_parse_succeeded'
  | 'canonical_schema_parse_failed';

export type ResponseParseDiagnostic = (
  stage: ResponseParseDiagnosticStage,
  status: number,
) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const PUBLIC_VALIDATION_FIELDS = new Set([
  'name',
  'email',
  'password',
  'age',
  'birthDate',
  'sex',
  'heightInches',
  'startingWeightLb',
  'activityLevel',
  'trainingStyle',
  'foodName',
  'description',
  'mealType',
  'calories',
  'protein',
  'carbs',
  'fat',
  'weightLb',
  'loggedAt',
  'timezone',
  'goalPace',
  'targetWeightLb',
  'targetCalories',
  'targetProteinGrams',
]);

const PUBLIC_VALIDATION_REASONS = new Set([
  'invalid',
  'required',
  'too_short',
  'too_long',
]);

export function sanitizePublicErrorDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  if (details.retryable === true) safe.retryable = true;

  for (const key of ['entryIndex', 'itemIndex']) {
    const value = details[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      safe[key] = value;
    }
  }

  if (Array.isArray(details.fields)) {
    const fields = details.fields.flatMap((field) => {
      if (!isRecord(field)) return [];
      const name = field.field;
      const reason = field.reason;
      if (
        typeof name !== 'string' ||
        !PUBLIC_VALIDATION_FIELDS.has(name) ||
        typeof reason !== 'string' ||
        !PUBLIC_VALIDATION_REASONS.has(reason)
      ) {
        return [];
      }
      return [{ field: name, reason }];
    });
    if (fields.length > 0) safe.fields = fields.slice(0, 20);
  }

  return safe;
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
  onStage?: ResponseParseDiagnostic,
): Promise<T> {
  let responseText: string;
  try {
    responseText = await response.text();
  } catch {
    onStage?.('response_text_read_failed', response.status);
    throw invalidResponse(response.status);
  }
  onStage?.('response_text_read', response.status);
  onDiagnostic?.('response_received', {
    status: response.status,
    contentType: response.headers.get('content-type') ?? 'missing',
    bodyByteLength: new TextEncoder().encode(responseText).byteLength,
  });

  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as unknown;
    onStage?.('json_parse_succeeded', response.status);
  } catch {
    onStage?.('json_parse_failed', response.status);
    onDiagnostic?.('response_json_parse_failed', {
      status: response.status,
    });
    throw invalidResponse(response.status);
  }

  if (!isRecord(payload) || typeof payload.success !== 'boolean') {
    onStage?.('envelope_parse_failed', response.status);
    onDiagnostic?.('response_envelope_parse_failed', {
      status: response.status,
    });
    throw invalidResponse(response.status);
  }
  onStage?.('envelope_parse_succeeded', response.status);

  const envelope = payload as unknown as ApiResponse<unknown>;
  if (!envelope.success) {
    if (
      !isRecord(envelope.error) ||
      typeof envelope.error.code !== 'string' ||
      typeof envelope.error.message !== 'string' ||
      !isRecord(envelope.error.details)
    ) {
      onStage?.('envelope_parse_failed', response.status);
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
    onStage?.('canonical_schema_parse_failed', response.status);
    onDiagnostic?.('response_schema_parse_failed', { status: response.status });
    throw invalidResponse(response.status);
  }
  onStage?.('canonical_schema_parse_succeeded', response.status);
  onDiagnostic?.('response_schema_parsed', { status: response.status });
  return parsed.data;
}
