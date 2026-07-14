import {
  MAX_SERVING_QUANTITY,
  parseServingText,
  photoNormalizedRegionSchema,
  photoConfidenceLevelSchema,
  photoProvisionalQuantitySchema,
  PHOTO_ANALYSIS_MAX_ITEMS,
  PHOTO_QUANTITY_STATES,
  PHOTO_QUANTITY_UNITS,
  type PhotoQuantityState,
  type PhotoQuantityUnit,
  type PhotoConfidenceLevel,
  type ParsedServingSuggestion,
} from '@food-tracker/shared';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import type { PhotoAnalysisConfig } from './photo-config.js';

export interface ProviderPhotoSuggestion {
  name: string;
  preparationForm: string | null;
  quantity: ProviderPhotoQuantity;
  identityConfidence: PhotoConfidenceLevel;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export type ProviderPhotoQuantity =
  | {
      quantityState: 'estimated';
      quantityAmount: number;
      quantityUnit: PhotoQuantityUnit;
      quantityCountLabel: string | null;
      quantityRawText: string;
      quantityConfidence: PhotoConfidenceLevel;
    }
  | {
      quantityState: 'no_responsible_estimate';
      quantityAmount: null;
      quantityUnit: null;
      quantityCountLabel: null;
      quantityRawText: null;
      quantityConfidence: null;
    };

export interface PhotoAnalysisProvider {
  analyze(input: {
    image: Uint8Array;
    mimeType: 'image/jpeg';
    signal: AbortSignal;
  }): Promise<ProviderPhotoSuggestion[]>;
}

const providerSuggestionSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  preparationForm: z.string().trim().min(1).max(80).nullable().default(null),
  identityConfidence: photoConfidenceLevelSchema,
  quantityState: z.enum(PHOTO_QUANTITY_STATES),
  quantityAmount: z
    .number()
    .finite()
    .positive()
    .max(MAX_SERVING_QUANTITY)
    .nullable(),
  quantityUnit: z.enum(PHOTO_QUANTITY_UNITS).nullable(),
  quantityCountLabel: z.string().trim().min(1).max(40).nullable(),
  quantityRawText: z.string().trim().min(1).max(120).nullable(),
  quantityConfidence: photoConfidenceLevelSchema.nullable(),
  // Region is optional provider metadata. It is validated separately so an
  // invalid box cannot invalidate otherwise valid identity and quantity data.
  region: z.unknown().nullable().default(null),
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
          identityConfidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          quantityState: {
            type: 'string',
            enum: [...PHOTO_QUANTITY_STATES],
          },
          quantityAmount: {
            type: 'number',
            nullable: true,
          },
          quantityUnit: {
            type: 'string',
            enum: [...PHOTO_QUANTITY_UNITS],
            nullable: true,
          },
          quantityCountLabel: {
            type: 'string',
            nullable: true,
          },
          quantityRawText: {
            type: 'string',
            nullable: true,
          },
          quantityConfidence: {
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
        required: [
          'name',
          'identityConfidence',
          'quantityState',
          'quantityAmount',
          'quantityUnit',
          'quantityCountLabel',
          'quantityRawText',
          'quantityConfidence',
          'preparationForm',
          'region',
        ],
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

function normalizeQuantity(input: {
  quantityState: PhotoQuantityState;
  quantityAmount: number | null;
  quantityUnit: PhotoQuantityUnit | null;
  quantityCountLabel: string | null;
  quantityRawText: string | null;
  quantityConfidence: PhotoConfidenceLevel | null;
}): ProviderPhotoQuantity {
  if (
    input.quantityState === 'no_responsible_estimate' &&
    (input.quantityAmount !== null ||
      input.quantityUnit !== null ||
      input.quantityCountLabel !== null ||
      input.quantityRawText !== null ||
      input.quantityConfidence !== null)
  ) {
    throw aiUnavailable('Photo analysis returned contradictory quantity data.');
  }

  const quantity =
    input.quantityState === 'estimated'
      ? {
          state: 'estimated' as const,
          amount: input.quantityAmount,
          unit: input.quantityUnit,
          countLabel: input.quantityCountLabel,
          rawText: input.quantityRawText,
          confidence: input.quantityConfidence,
        }
      : { state: 'no_responsible_estimate' as const };

  const parsed = photoProvisionalQuantitySchema.safeParse(quantity);
  if (!parsed.success) {
    logDiagnostic('quantity_semantic_validation_failure', {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
    throw aiUnavailable('Photo analysis returned an invalid quantity.');
  }

  return parsed.data.state === 'estimated'
    ? {
        quantityState: 'estimated',
        quantityAmount: parsed.data.amount,
        quantityUnit: parsed.data.unit,
        quantityCountLabel: parsed.data.countLabel,
        quantityRawText: parsed.data.rawText,
        quantityConfidence: parsed.data.confidence,
      }
    : {
        quantityState: 'no_responsible_estimate',
        quantityAmount: null,
        quantityUnit: null,
        quantityCountLabel: null,
        quantityRawText: null,
        quantityConfidence: null,
      };
}

type OptionalRegionViolationCategory =
  | 'malformed_object'
  | 'missing_fields'
  | 'non_numeric'
  | 'non_finite'
  | 'below_zero'
  | 'above_one'
  | 'reversed_bounds'
  | 'zero_area';

const optionalRegionFields = ['x', 'y', 'width', 'height'] as const;

function optionalRegionViolationCategories(
  value: unknown,
): OptionalRegionViolationCategory[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['malformed_object'];
  }

  const region = value as Record<string, unknown>;
  const categories = new Set<OptionalRegionViolationCategory>();
  if (
    Object.keys(region).some(
      (field) =>
        !optionalRegionFields.includes(
          field as (typeof optionalRegionFields)[number],
        ),
    )
  ) {
    categories.add('malformed_object');
  }
  const missing = optionalRegionFields.filter((field) => !(field in region));
  if (missing.length > 0) categories.add('missing_fields');

  for (const field of optionalRegionFields) {
    const coordinate = region[field];
    if (typeof coordinate !== 'number') {
      categories.add('non_numeric');
      continue;
    }
    if (!Number.isFinite(coordinate)) {
      categories.add('non_finite');
      continue;
    }
    if (coordinate < 0) categories.add('below_zero');
    if (coordinate > 1) categories.add('above_one');
  }

  const x = region.x;
  const y = region.y;
  const width = region.width;
  const height = region.height;
  if (
    typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof width === 'number' &&
    Number.isFinite(width)
  ) {
    if (width < 0) categories.add('reversed_bounds');
    if (width === 0) categories.add('zero_area');
    if (x + width > 1) categories.add('above_one');
  }
  if (
    typeof y === 'number' &&
    Number.isFinite(y) &&
    typeof height === 'number' &&
    Number.isFinite(height)
  ) {
    if (height < 0) categories.add('reversed_bounds');
    if (height === 0) categories.add('zero_area');
    if (y + height > 1) categories.add('above_one');
  }

  return [...categories];
}

function parseOptionalRegion(
  value: unknown,
  itemIndex: number,
): ProviderPhotoSuggestion['region'] {
  if (value === null || value === undefined) return null;

  const violationCategories = optionalRegionViolationCategories(value);
  const parsed = photoNormalizedRegionSchema.safeParse(value);
  if (parsed.success && violationCategories.length === 0) return parsed.data;

  logDiagnostic('provider_optional_region_discarded', {
    itemIndex,
    invalidFieldPaths: parsed.success
      ? violationCategories.includes('zero_area')
        ? [['width'], ['height']]
        : []
      : parsed.error.issues.map((issue) => issue.path.map(String)),
    violationCategories,
  });
  return null;
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

  return parsed.data.items.map((item, itemIndex) => ({
    name: item.name,
    preparationForm: item.preparationForm,
    identityConfidence: item.identityConfidence,
    quantity: normalizeQuantity(item),
    region: parseOptionalRegion(item.region, itemIndex),
  }));
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
        quantity: {
          quantityState: 'no_responsible_estimate',
          quantityAmount: null,
          quantityUnit: null,
          quantityCountLabel: null,
          quantityRawText: null,
          quantityConfidence: null,
        },
        identityConfidence: 'medium',
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
                      'Estimate quantity only when visually defensible. Use only count, slice, piece, tablespoon, teaspoon, cup, millilitre, gram, or ounce.',
                      'Use count only for visually countable discrete objects and include a concise count label such as egg, sandwich, breast, patty, or dumpling.',
                      'Never use generic count labels such as item, food, serving, meal, pasta, sauce, Parmesan, cheese, or rice.',
                      'For pasta, rice, sauce, grated cheese, and similar foods, use a meaningful volume or weight only when visually defensible; otherwise use no_responsible_estimate.',
                      'Use quantityState estimated with positive quantityAmount, quantityUnit, quantityRawText, and quantityConfidence when estimating. Use no_responsible_estimate with all other quantity fields null when you cannot estimate responsibly.',
                      'Do not invent exact weight, density, serving conversions, calories, protein, carbohydrates, fat, micronutrients, database IDs, trusted-food references, or reasoning.',
                      'Regions are optional normalized x, y, width, and height values from 0 to 1; never use pixels or percentages, and return null when the bounds cannot be kept inside the image.',
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
