import { z } from 'zod';
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

const providerItemSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  quantityText: z.string().trim().min(1).max(80).nullable().default(null),
  servingText: z.string().trim().min(1).max(120).nullable().default(null),
});

const providerOutputSchema = z.strictObject({
  items: z.array(providerItemSchema).min(1).max(12),
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

function aiUnavailable(message = 'AI food parsing is unavailable.'): AppError {
  return new AppError(503, 'AI_UNAVAILABLE', message);
}

function diagnosticText(value: string): string {
  return value
    .replace(
      /(api[_-]?key|key|token|authorization)["':=\s]+[^"',\s}]+/gi,
      '$1=[redacted]',
    )
    .replace(/Meal description:\s*.+/gi, 'Meal description: [redacted]')
    .slice(0, 1_000);
}

async function responseDiagnostic(response: Response): Promise<string> {
  try {
    return diagnosticText(await response.text());
  } catch {
    return '[unreadable response body]';
  }
}

function logGeminiDiagnostic(
  category: string,
  details: Record<string, unknown>,
): void {
  console.warn('[ai-food-parse:gemini]', {
    category,
    ...details,
  });
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
    .map((part) => cleanParsedName(part))
    .filter((item) => item.name.length > 0)
    .slice(0, maxItems)
    .map((item) => ({
      name: item.name,
      quantityText: item.quantityText,
      servingText: item.quantityText,
    }));
}

class DisabledFoodParseProvider implements FoodParseProvider {
  async parse(): Promise<ProviderParsedFoodItem[]> {
    throw aiUnavailable('AI food parsing is turned off.');
  }
}

class MockFoodParseProvider implements FoodParseProvider {
  constructor(private readonly config: AiFoodParseConfig) {}

  async parse(description: string): Promise<ProviderParsedFoodItem[]> {
    return mockParse(description, this.config.maxItems);
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
          statusText: response.statusText,
          body: await responseDiagnostic(response),
        });
        throw aiUnavailable('AI food parsing could not be reached.');
      }

      const payload = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

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
      } catch (error) {
        logGeminiDiagnostic('json_parse_failure', {
          message: error instanceof Error ? error.message : 'unknown',
          text: diagnosticText(text),
        });
        throw aiUnavailable('AI food parsing returned invalid JSON.');
      }

      const parsed = providerOutputSchema.safeParse(output);
      if (!parsed.success) {
        logGeminiDiagnostic('schema_validation_failure', {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
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
        { message: error instanceof Error ? error.message : 'unknown' },
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
