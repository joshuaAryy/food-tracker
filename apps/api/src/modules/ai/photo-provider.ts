import {
  parseServingText,
  photoNormalizedRegionSchema,
  photoConfidenceLevelSchema,
  PHOTO_ANALYSIS_MAX_ITEMS,
  type PhotoConfidenceLevel,
  type ParsedServingSuggestion,
} from '@food-tracker/shared';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import type { PhotoAnalysisConfig } from './photo-config.js';

export interface ProviderPhotoSuggestion {
  name: string;
  preparationForm: string | null;
  quantityText: string | null;
  servingText: string | null;
  identityConfidence: PhotoConfidenceLevel;
  portionConfidence: PhotoConfidenceLevel | null;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface PhotoAnalysisProvider {
  analyze(input: {
    image: Uint8Array;
    mimeType: 'image/jpeg';
    signal: AbortSignal;
  }): Promise<ProviderPhotoSuggestion[]>;
}

const providerSuggestionSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    preparationForm: z.string().trim().min(1).max(80).nullable().default(null),
    quantityText: z.string().trim().min(1).max(80).nullable().default(null),
    servingText: z.string().trim().min(1).max(120).nullable().default(null),
    identityConfidence: photoConfidenceLevelSchema,
    portionConfidence: photoConfidenceLevelSchema.nullable().default(null),
    region: photoNormalizedRegionSchema.nullable().default(null),
  })
  .superRefine((item, context) => {
    const hasPortion = item.quantityText !== null || item.servingText !== null;
    if (hasPortion && item.portionConfidence === null) {
      context.addIssue({
        code: 'custom',
        message:
          'portionConfidence is required when portion wording is present',
        path: ['portionConfidence'],
      });
    }
    if (!hasPortion && item.portionConfidence !== null) {
      context.addIssue({
        code: 'custom',
        message:
          'portionConfidence must be null when portion wording is absent',
        path: ['portionConfidence'],
      });
    }
  });

const providerOutputSchema = z.strictObject({
  items: z.array(providerSuggestionSchema).max(PHOTO_ANALYSIS_MAX_ITEMS),
});

const geminiResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      maxItems: PHOTO_ANALYSIS_MAX_ITEMS,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          preparationForm: { type: 'string', nullable: true },
          quantityText: { type: 'string', nullable: true },
          servingText: { type: 'string', nullable: true },
          identityConfidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          portionConfidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            nullable: true,
          },
          region: {
            type: 'object',
            nullable: true,
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
            required: ['x', 'y', 'width', 'height'],
          },
        },
        required: ['name', 'identityConfidence'],
      },
    },
  },
  required: ['items'],
} as const;

function aiUnavailable(message: string): AppError {
  return new AppError(503, 'AI_UNAVAILABLE', message);
}

function providerRateLimited(): AppError {
  return new AppError(
    429,
    'RATE_LIMITED',
    'Photo analysis is temporarily limited. Try again later.',
  );
}

function diagnosticText(value: string): string {
  return value
    .replace(
      /(api[_-]?key|key|token|authorization)["':=\s]+[^"',\s}]+/gi,
      '$1=[redacted]',
    )
    .slice(0, 500);
}

function logDiagnostic(category: string, details: Record<string, unknown>) {
  console.warn('[photo-analysis:provider]', { category, ...details });
}

type GeminiErrorBody = {
  error?: {
    code?: unknown;
    status?: unknown;
    message?: unknown;
    details?: unknown;
  };
};

function safeText(value: unknown): string | undefined {
  return typeof value === 'string' ? diagnosticText(value) : undefined;
}

function fieldViolationPaths(details: unknown): string[] | undefined {
  if (!Array.isArray(details)) return undefined;

  const paths = details.flatMap((detail) => {
    if (typeof detail !== 'object' || detail === null) return [];
    const violations = (detail as { fieldViolations?: unknown })
      .fieldViolations;
    if (!Array.isArray(violations)) return [];
    return violations.flatMap((violation) => {
      if (typeof violation !== 'object' || violation === null) return [];
      const field = (violation as { field?: unknown }).field;
      return typeof field === 'string' ? [diagnosticText(field)] : [];
    });
  });

  return paths.length > 0 ? paths.slice(0, 10) : undefined;
}

async function geminiErrorDiagnostic(
  response: Response,
): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { providerBody: '[unreadable response body]' };
  }

  try {
    const parsed = JSON.parse(text) as GeminiErrorBody;
    const error = parsed.error;
    if (typeof error !== 'object' || error === null) {
      return { providerBody: diagnosticText(text) };
    }
    return {
      providerCode: typeof error.code === 'number' ? error.code : undefined,
      providerStatus: safeText(error.status),
      providerMessage: safeText(error.message),
      fieldViolationPaths: fieldViolationPaths(error.details),
    };
  } catch {
    return { providerBody: diagnosticText(text) };
  }
}

type GeminiPart = Record<string, unknown>;
type GeminiCandidate = {
  content?: { parts?: unknown };
  finishReason?: unknown;
  finishMessage?: unknown;
};
type GeminiUsageMetadata = {
  promptTokenCount?: unknown;
  candidatesTokenCount?: unknown;
  thoughtsTokenCount?: unknown;
  totalTokenCount?: unknown;
};
type GeminiResponsePayload = {
  candidates?: unknown;
  usageMetadata?: GeminiUsageMetadata;
};

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function partType(part: GeminiPart): string {
  const known = Object.keys(part).filter(
    (key) => key !== 'thought' && key !== 'thoughtSignature',
  );
  return known.length > 0 ? known.join(',') : 'thought_metadata';
}

function isThoughtPart(part: GeminiPart): boolean {
  return part.thought === true || typeof part.thoughtSignature === 'string';
}

function responseMetadata(input: {
  payload: GeminiResponsePayload;
  candidate: GeminiCandidate | undefined;
  candidateCount: number;
  selectedCandidateIndex: number;
  model: string;
  configuredMaxOutputTokens: number;
  requestElapsedMs: number;
  parts: GeminiPart[];
  assembledOutputLength: number;
}): Record<string, unknown> {
  return {
    status: 200,
    model: input.model,
    candidateCount: input.candidateCount,
    selectedCandidateIndex: input.selectedCandidateIndex,
    finishReason:
      typeof input.candidate?.finishReason === 'string'
        ? input.candidate.finishReason
        : undefined,
    finishMessage: safeText(input.candidate?.finishMessage),
    contentPartCount: input.parts.length,
    contentPartTypes: input.parts.map(partType),
    thoughtParts: input.parts.map(isThoughtPart),
    outputTextPartLengths: input.parts.map((part) =>
      typeof part.text === 'string' ? part.text.length : 0,
    ),
    assembledOutputLength: input.assembledOutputLength,
    promptTokenCount: safeNumber(input.payload.usageMetadata?.promptTokenCount),
    candidatesTokenCount: safeNumber(
      input.payload.usageMetadata?.candidatesTokenCount,
    ),
    thoughtsTokenCount: safeNumber(
      input.payload.usageMetadata?.thoughtsTokenCount,
    ),
    totalTokenCount: safeNumber(input.payload.usageMetadata?.totalTokenCount),
    configuredMaxOutputTokens: input.configuredMaxOutputTokens,
    requestElapsedMs: input.requestElapsedMs,
  };
}

function responseTextParts(
  candidate: GeminiCandidate,
  metadata: Record<string, unknown>,
): string {
  const rawParts = candidate.content?.parts;
  if (!Array.isArray(rawParts)) {
    logDiagnostic('provider_empty_output', metadata);
    throw aiUnavailable('Photo analysis returned an empty response.');
  }

  const parts = rawParts.filter(
    (part): part is GeminiPart => typeof part === 'object' && part !== null,
  );
  if (parts.length !== rawParts.length) {
    logDiagnostic('provider_unsupported_part', metadata);
    throw aiUnavailable('Photo analysis returned an unsupported response.');
  }

  const output: string[] = [];
  for (const part of parts) {
    if (isThoughtPart(part)) continue;
    if (typeof part.text === 'string') {
      output.push(part.text);
      continue;
    }
    logDiagnostic('provider_unsupported_part', {
      ...metadata,
      unsupportedPartType: partType(part),
    });
    throw aiUnavailable('Photo analysis returned an unsupported response.');
  }

  const assembled = output.join('');
  if (assembled.trim() === '') {
    logDiagnostic('provider_empty_output', metadata);
    throw aiUnavailable('Photo analysis returned an empty response.');
  }
  return assembled;
}

class ProviderJsonSyntaxError extends Error {}

export function parsePhotoServingText(input: {
  quantityText: string | null;
  servingText: string | null;
}): ParsedServingSuggestion {
  const parsed = parseServingText(input);
  if (
    parsed.status === 'needs_review' &&
    parsed.reason === 'missing_unit' &&
    input.servingText !== null
  ) {
    const servingOnly = parseServingText({ servingText: input.servingText });
    if (servingOnly.status === 'parsed') {
      return {
        ...servingOnly,
        rawQuantityText: input.quantityText,
        rawServingText: input.servingText,
      };
    }
  }
  return parsed;
}

function validatePortionSafety(item: ProviderPhotoSuggestion): void {
  const parsed = parsePhotoServingText({
    quantityText: item.quantityText,
    servingText: item.servingText,
  });
  if (parsed.status === 'invalid') {
    throw aiUnavailable('Photo analysis returned an invalid portion.');
  }
}

function parseProviderOutput(text: string): ProviderPhotoSuggestion[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text.trim());
  } catch (error) {
    throw new ProviderJsonSyntaxError(
      error instanceof Error ? error.message : 'unknown',
    );
  }

  const parsed = providerOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    logDiagnostic('schema_validation_failure', {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
    throw aiUnavailable('Photo analysis returned an invalid response.');
  }

  for (const item of parsed.data.items) validatePortionSafety(item);
  return parsed.data.items;
}

class DisabledPhotoAnalysisProvider implements PhotoAnalysisProvider {
  async analyze(): Promise<ProviderPhotoSuggestion[]> {
    throw aiUnavailable('Photo analysis is turned off.');
  }
}

class MockPhotoAnalysisProvider implements PhotoAnalysisProvider {
  async analyze(): Promise<ProviderPhotoSuggestion[]> {
    return [
      {
        name: 'chicken',
        preparationForm: null,
        quantityText: null,
        servingText: null,
        identityConfidence: 'medium',
        portionConfidence: null,
        region: null,
      },
    ];
  }
}

class GeminiPhotoAnalysisProvider implements PhotoAnalysisProvider {
  constructor(private readonly config: PhotoAnalysisConfig) {}

  async analyze(input: {
    image: Uint8Array;
    mimeType: 'image/jpeg';
    signal: AbortSignal;
  }): Promise<ProviderPhotoSuggestion[]> {
    if (this.config.geminiApiKey === null) {
      throw aiUnavailable('Photo analysis is not configured.');
    }

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    if (input.signal.aborted) controller.abort();
    input.signal.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const requestStartedAt = Date.now();

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          this.config.geminiModel,
        )}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.config.geminiApiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: input.mimeType,
                      data: Buffer.from(input.image).toString('base64'),
                    },
                  },
                  {
                    text: [
                      'Analyze this food photo and return structured JSON only.',
                      'Return zero to eight independent foods visibly present.',
                      'Identify food names and optional preparation forms only.',
                      'You may suggest raw portion wording such as 150 g, 1 cup, 2 eggs, or 1 slice, but never convert it or infer density.',
                      'Use identityConfidence and portionConfidence with only high, medium, or low.',
                      'When both quantityText and servingText are null, omit portionConfidence entirely or set it to null; never set it to high, medium, or low. When either portion field is present, portionConfidence must be high, medium, or low.',
                      'Regions are optional normalized x, y, width, and height values from 0 to 1 and are metadata only.',
                      'Do not return calories, protein, carbohydrates, fat, fiber, sugar, sodium, micronutrients, nutrient totals, density assumptions, database IDs, FoodItem references, candidate selections, automatic saves, prompts, or internal reasoning.',
                    ].join('\n'),
                  },
                ],
              },
            ],
            generationConfig: {
              candidateCount: 1,
              thinkingConfig: { thinkingBudget: 0 },
              temperature: 0.1,
              maxOutputTokens: this.config.maxOutputTokens,
              responseMimeType: 'application/json',
              responseSchema: geminiResponseSchema,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        logDiagnostic('non_ok_response', {
          status: response.status,
          statusText: response.statusText,
          model: this.config.geminiModel,
          stage: 'generate_content',
          ...(await geminiErrorDiagnostic(response)),
        });
        if (response.status === 429) throw providerRateLimited();
        throw aiUnavailable('Photo analysis could not be reached.');
      }

      let payload: GeminiResponsePayload;
      try {
        payload = (await response.json()) as GeminiResponsePayload;
      } catch (error) {
        logDiagnostic('response_json_failure', {
          message:
            error instanceof Error ? diagnosticText(error.message) : 'unknown',
        });
        throw aiUnavailable('Photo analysis returned an unreadable response.');
      }

      const candidates = Array.isArray(payload.candidates)
        ? payload.candidates
        : [];
      const candidateCount = candidates.length;
      const selectedCandidateIndex = 0;
      const candidate = candidates[selectedCandidateIndex] as
        | GeminiCandidate
        | undefined;
      const rawParts =
        candidate?.content !== undefined &&
        Array.isArray(candidate.content.parts)
          ? candidate.content.parts
          : [];
      const parts = rawParts.filter(
        (part): part is GeminiPart => typeof part === 'object' && part !== null,
      );
      const baseMetadata = responseMetadata({
        payload,
        candidate,
        candidateCount,
        selectedCandidateIndex,
        model: this.config.geminiModel,
        configuredMaxOutputTokens: this.config.maxOutputTokens,
        requestElapsedMs: Date.now() - requestStartedAt,
        parts,
        assembledOutputLength: parts.reduce(
          (length, part) =>
            length +
            (isThoughtPart(part) || typeof part.text !== 'string'
              ? 0
              : part.text.length),
          0,
        ),
      });
      const finishReason = candidate?.finishReason;
      if (finishReason !== 'STOP') {
        const category =
          finishReason === 'MAX_TOKENS'
            ? 'provider_output_truncated'
            : finishReason === undefined
              ? 'provider_incomplete_response'
              : 'provider_completion_error';
        logDiagnostic(category, baseMetadata);
        throw aiUnavailable(
          finishReason === 'MAX_TOKENS'
            ? 'Photo analysis was cut off. Try again.'
            : 'Photo analysis did not complete. Try again.',
        );
      }

      if (candidate === undefined) {
        logDiagnostic('provider_incomplete_response', baseMetadata);
        throw aiUnavailable('Photo analysis returned an incomplete response.');
      }

      const text = responseTextParts(candidate, baseMetadata);
      const completedMetadata = {
        ...baseMetadata,
        assembledOutputLength: text.length,
      };
      logDiagnostic('response_metadata', completedMetadata);

      try {
        return parseProviderOutput(text).slice(0, this.config.maxItems);
      } catch (error) {
        if (error instanceof ProviderJsonSyntaxError) {
          logDiagnostic('provider_malformed_completed_json', completedMetadata);
          throw aiUnavailable('Photo analysis returned invalid JSON.');
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof AppError) throw error;

      const aborted =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError');
      logDiagnostic(aborted ? 'timeout_or_cancelled' : 'request_failure', {
        message:
          error instanceof Error ? diagnosticText(error.message) : 'unknown',
      });
      throw aiUnavailable(
        aborted ? 'Photo analysis timed out.' : 'Photo analysis failed.',
      );
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener('abort', abortFromCaller);
    }
  }
}

export function photoAnalysisProvider(
  config: PhotoAnalysisConfig,
): PhotoAnalysisProvider {
  if (config.provider === 'mock') return new MockPhotoAnalysisProvider();
  if (config.provider === 'gemini') {
    return new GeminiPhotoAnalysisProvider(config);
  }
  return new DisabledPhotoAnalysisProvider();
}

export { parseProviderOutput };
