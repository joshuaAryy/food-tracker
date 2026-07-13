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
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      maxItems: PHOTO_ANALYSIS_MAX_ITEMS,
      items: {
        type: 'object',
        additionalProperties: false,
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
            additionalProperties: false,
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

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced?.[1] !== undefined) return fenced[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function responseText(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return undefined;

  for (const candidate of candidates) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const content = (candidate as { content?: unknown }).content;
    if (typeof content !== 'object' || content === null) continue;
    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (typeof part !== 'object' || part === null) continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === 'string') return text;
    }
  }

  return undefined;
}

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
    decoded = JSON.parse(extractJsonText(text));
  } catch (error) {
    logDiagnostic('json_parse_failure', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    throw aiUnavailable('Photo analysis returned invalid JSON.');
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
                    inline_data: {
                      mime_type: input.mimeType,
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
                      'Regions are optional normalized x, y, width, and height values from 0 to 1 and are metadata only.',
                      'Do not return calories, protein, carbohydrates, fat, fiber, sugar, sodium, micronutrients, nutrient totals, density assumptions, database IDs, FoodItem references, candidate selections, automatic saves, prompts, or internal reasoning.',
                    ].join('\n'),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 768,
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
        });
        if (response.status === 429) throw providerRateLimited();
        throw aiUnavailable('Photo analysis could not be reached.');
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        logDiagnostic('response_json_failure', {
          message:
            error instanceof Error ? diagnosticText(error.message) : 'unknown',
        });
        throw aiUnavailable('Photo analysis returned an unreadable response.');
      }

      const text = responseText(payload);
      if (text === undefined) {
        logDiagnostic('missing_text_part', {});
        throw aiUnavailable('Photo analysis returned an unreadable response.');
      }

      return parseProviderOutput(text).slice(0, this.config.maxItems);
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
