import { z } from 'zod';
import { emitServerDiagnostic } from '../../lib/diagnostics.js';
import { AppError } from '../../lib/errors.js';
import type { AiFoodParseConfig } from './config.js';

export interface ProviderParsedFoodItem {
  name: string;
  quantityText: string | null;
  servingText: string | null;
}

export interface FoodParseProvider {
  parse(description: string): Promise<ProviderParsedFoodItem[]>;
}

export interface ProviderNutritionEstimate {
  foodName: string;
  servingText: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
}

export interface NutritionEstimateProvider {
  estimate(input: {
    parsedName: string;
    quantityText: string | null;
    servingText: string | null;
    description: string | null;
  }): Promise<ProviderNutritionEstimate>;
}

const providerItemSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  quantityText: z.string().trim().min(1).max(80).nullable().default(null),
  servingText: z.string().trim().min(1).max(120).nullable().default(null),
});

const providerOutputSchema = z.strictObject({
  items: z.array(providerItemSchema).min(1).max(12),
});

const nutritionEstimateOutputSchema = z.strictObject({
  foodName: z.string().trim().min(1).max(120),
  servingText: z.string().trim().min(1).max(120).nullable().default(null),
  calories: z.number().int().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative().nullable().default(null),
  sugar: z.number().nonnegative().nullable().default(null),
  sodium: z.number().int().nonnegative().nullable().default(null),
});

const geminiResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantityText: { type: 'string', nullable: true },
          servingText: { type: 'string', nullable: true },
        },
        required: ['name'],
      },
    },
  },
  required: ['items'],
} as const;

const geminiNutritionEstimateResponseSchema = {
  type: 'object',
  properties: {
    foodName: { type: 'string' },
    servingText: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    fiber: { type: 'number' },
    sugar: { type: 'number' },
    sodium: { type: 'number' },
  },
  required: ['foodName', 'calories', 'protein', 'carbs', 'fat'],
} as const;

function aiUnavailable(
  message = 'AI food parsing is unavailable.',
  publicMessageKey?:
    | 'nutrition_estimate_cut_off'
    | 'nutrition_estimate_unavailable',
): AppError {
  return new AppError(
    503,
    'AI_UNAVAILABLE',
    message,
    publicMessageKey === undefined ? {} : { publicMessageKey },
  );
}

function logGeminiDiagnostic(
  category: string,
  details: Record<string, unknown>,
): void {
  emitServerDiagnostic(category, details, 'ai-food-parse:gemini');
}

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced?.[1] !== undefined) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function firstTextPart(payload: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}): string | undefined {
  return textParts(payload)[0];
}

function textParts(payload: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}): string[] {
  return (
    payload.candidates?.flatMap(
      (candidate) =>
        candidate.content?.parts?.flatMap((part) =>
          typeof part.text === 'string' ? [part.text] : [],
        ) ?? [],
    ) ?? []
  );
}

function valueKind(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  }

  if (value === null) {
    return 'null';
  }

  return typeof value;
}

function geminiCandidateDiagnostics(payload: {
  candidates?: {
    content?: { parts?: Record<string, unknown>[] };
    finishReason?: unknown;
    safetyRatings?: unknown;
  }[];
}): {
  candidates: number;
  finishReasons: unknown[];
  partShapes: Record<string, string>[][];
  safetyRatings: unknown[];
} {
  const candidates = payload.candidates ?? [];

  return {
    candidates: candidates.length,
    finishReasons: candidates.map((candidate) => candidate.finishReason),
    partShapes: candidates.map(
      (candidate) =>
        candidate.content?.parts?.map((part) =>
          Object.fromEntries(
            Object.entries(part).map(([key, value]) => [key, valueKind(value)]),
          ),
        ) ?? [],
    ),
    safetyRatings: candidates.flatMap((candidate) =>
      candidate.safetyRatings === undefined ? [] : [candidate.safetyRatings],
    ),
  };
}

function jsonObjectCandidates(text: string): string[] {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (fenced?.[1] !== undefined) {
    return [fenced[1].trim()];
  }

  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (char === undefined) continue;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        candidates.push(trimmed.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates.length > 0 ? candidates : [trimmed];
}

function parseFirstValidNutritionEstimate(payload: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}): ProviderNutritionEstimate | null {
  for (const text of textParts(payload)) {
    for (const jsonText of jsonObjectCandidates(text)) {
      let output: unknown;
      try {
        output = JSON.parse(jsonText);
      } catch {
        continue;
      }

      const parsed = nutritionEstimateOutputSchema.safeParse(output);
      if (parsed.success) {
        return parsed.data;
      }
    }
  }

  return null;
}

function hasAnyTextPart(payload: {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}): boolean {
  return textParts(payload).length > 0;
}

function hasFinishReason(
  payload: { candidates?: { finishReason?: unknown }[] },
  finishReason: string,
): boolean {
  return (
    payload.candidates?.some(
      (candidate) => candidate.finishReason === finishReason,
    ) ?? false
  );
}

function cleanParsedName(value: string): {
  name: string;
  quantityText: string | null;
} {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  const match =
    /^((?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+)(.+)$/i.exec(
      trimmed,
    );

  if (match === null) {
    return { name: trimmed, quantityText: null };
  }

  return {
    name: match[2]?.trim() ?? trimmed,
    quantityText: match[1]?.trim() ?? null,
  };
}

function mockParse(
  description: string,
  maxItems: number,
): ProviderParsedFoodItem[] {
  return description
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map((part) => ({ ...cleanParsedName(part), rawText: part.trim() }))
    .filter((item) => item.name.length > 0)
    .slice(0, maxItems)
    .map((item) => ({
      name: item.name,
      quantityText: item.quantityText,
      servingText: item.quantityText === null ? null : item.rawText,
    }));
}

class DisabledFoodParseProvider implements FoodParseProvider {
  async parse(): Promise<ProviderParsedFoodItem[]> {
    throw aiUnavailable('AI food parsing is turned off.');
  }
}

class DisabledNutritionEstimateProvider implements NutritionEstimateProvider {
  async estimate(): Promise<ProviderNutritionEstimate> {
    throw aiUnavailable('AI nutrition estimates are turned off.');
  }
}

class MockFoodParseProvider implements FoodParseProvider {
  constructor(private readonly config: AiFoodParseConfig) {}

  async parse(description: string): Promise<ProviderParsedFoodItem[]> {
    return mockParse(description, this.config.maxItems);
  }
}

class MockNutritionEstimateProvider implements NutritionEstimateProvider {
  async estimate(input: {
    parsedName: string;
    quantityText: string | null;
    servingText: string | null;
  }): Promise<ProviderNutritionEstimate> {
    return {
      foodName: input.parsedName,
      servingText: input.servingText ?? input.quantityText,
      calories: 400,
      protein: 20,
      carbs: 40,
      fat: 15,
      fiber: null,
      sugar: null,
      sodium: null,
    };
  }
}

class GeminiFoodParseProvider implements FoodParseProvider {
  constructor(private readonly config: AiFoodParseConfig) {}

  async parse(description: string): Promise<ProviderParsedFoodItem[]> {
    if (this.config.geminiApiKey === null) {
      throw aiUnavailable('AI food parsing is not configured.');
    }

    const controller = new AbortController();
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
                    text: [
                      'Parse this meal description into food items.',
                      'Return only foods the user appears to have eaten.',
                      'Do not include calories, macros, micronutrients, or database IDs.',
                      'For each item, preserve raw quantity and serving wording. Put the numeric or fraction quantity in quantityText when explicit, and the complete serving phrase including its unit in servingText. Leave both null when no serving was stated. Never convert or calculate.',
                      `Maximum items: ${this.config.maxItems}.`,
                      `Meal description: ${description}`,
                    ].join('\n'),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 512,
              responseMimeType: 'application/json',
              responseSchema: geminiResponseSchema,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        logGeminiDiagnostic('non_ok_response', {
          status: response.status,
          operation: 'food_parse',
        });
        throw aiUnavailable('AI food parsing could not be reached.');
      }

      const payload = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = firstTextPart(payload);

      if (typeof text !== 'string') {
        logGeminiDiagnostic('missing_text_part', {
          status: response.status,
          candidates: payload.candidates?.length ?? 0,
        });
        throw aiUnavailable('AI food parsing returned an unreadable response.');
      }

      let output: unknown;
      try {
        output = JSON.parse(extractJsonText(text));
      } catch {
        logGeminiDiagnostic('json_parse_failure', {
          operation: 'food_parse',
        });
        throw aiUnavailable('AI food parsing returned invalid JSON.');
      }

      const parsed = providerOutputSchema.safeParse(output);
      if (!parsed.success) {
        logGeminiDiagnostic('schema_validation_failure', {
          errorCategory: 'schema_validation',
        });
        throw aiUnavailable('AI food parsing returned an invalid response.');
      }

      return parsed.data.items.slice(0, this.config.maxItems);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logGeminiDiagnostic(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'timeout'
          : 'request_failure',
        {
          operation: 'food_parse',
          errorCategory:
            error instanceof Error && error.name === 'AbortError'
              ? 'timeout'
              : 'network_or_provider',
        },
      );

      throw aiUnavailable(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'AI food parsing timed out.'
          : 'AI food parsing failed.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

class GeminiNutritionEstimateProvider implements NutritionEstimateProvider {
  constructor(private readonly config: AiFoodParseConfig) {}

  async estimate(input: {
    parsedName: string;
    quantityText: string | null;
    servingText: string | null;
    description: string | null;
  }): Promise<ProviderNutritionEstimate> {
    if (this.config.geminiApiKey === null) {
      throw aiUnavailable('AI nutrition estimates are not configured.');
    }

    const controller = new AbortController();
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
                    text: [
                      'Return JSON for a low-trust nutrition estimate.',
                      'Fields only: foodName, servingText, calories, protein, carbs, fat, optional fiber, sugar, sodium.',
                      'No vitamins, minerals, amino acids, source IDs, database IDs, nutrients object, or markdown.',
                      'Omit optional fiber, sugar, and sodium when uncertain.',
                      `Food row: ${input.parsedName}`,
                      `Quantity text: ${input.quantityText ?? 'unknown'}`,
                      `Serving text: ${input.servingText ?? 'unknown'}`,
                      `Meal description: ${input.description ?? '[not provided]'}`,
                    ].join('\n'),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 768,
              responseMimeType: 'application/json',
              responseSchema: geminiNutritionEstimateResponseSchema,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        logGeminiDiagnostic('nutrition_estimate_non_ok_response', {
          status: response.status,
          operation: 'nutrition_estimate',
        });
        if (response.status === 429 || response.status === 503) {
          throw aiUnavailable(
            'AI nutrition estimates are temporarily unavailable.',
            'nutrition_estimate_unavailable',
          );
        }
        throw aiUnavailable('AI nutrition estimates could not be reached.');
      }

      const payload = (await response.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          finishReason?: unknown;
        }[];
      };

      if (hasFinishReason(payload, 'MAX_TOKENS')) {
        logGeminiDiagnostic('nutrition_estimate_max_tokens', {
          status: response.status,
          ...geminiCandidateDiagnostics(payload),
        });
        throw aiUnavailable(
          'AI nutrition estimates were cut off. Try again.',
          'nutrition_estimate_cut_off',
        );
      }

      if (!hasAnyTextPart(payload)) {
        logGeminiDiagnostic('nutrition_estimate_missing_text_part', {
          status: response.status,
          ...geminiCandidateDiagnostics(payload),
        });
        throw aiUnavailable(
          'AI nutrition estimates returned an unreadable response.',
        );
      }

      const parsed = parseFirstValidNutritionEstimate(payload);
      if (parsed === null) {
        logGeminiDiagnostic('nutrition_estimate_no_valid_json', {
          textPartCount: textParts(payload).length,
        });
        throw aiUnavailable('AI nutrition estimates returned invalid JSON.');
      }

      return parsed;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logGeminiDiagnostic(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'nutrition_estimate_timeout'
          : 'nutrition_estimate_request_failure',
        {
          operation: 'nutrition_estimate',
          errorCategory:
            error instanceof Error && error.name === 'AbortError'
              ? 'timeout'
              : 'network_or_provider',
        },
      );

      throw aiUnavailable(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'AI nutrition estimates timed out.'
          : 'AI nutrition estimates failed.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function foodParseProvider(
  config: AiFoodParseConfig,
): FoodParseProvider {
  if (config.provider === 'mock') {
    return new MockFoodParseProvider(config);
  }

  if (config.provider === 'gemini') {
    return new GeminiFoodParseProvider(config);
  }

  return new DisabledFoodParseProvider();
}

export function nutritionEstimateProvider(
  config: AiFoodParseConfig,
): NutritionEstimateProvider {
  if (config.provider === 'mock') {
    return new MockNutritionEstimateProvider();
  }

  if (config.provider === 'gemini') {
    return new GeminiNutritionEstimateProvider(config);
  }

  return new DisabledNutritionEstimateProvider();
}
