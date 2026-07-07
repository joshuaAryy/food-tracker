export type AiProviderName = 'disabled' | 'mock' | 'gemini';

export interface AiFoodParseConfig {
  provider: AiProviderName;
  geminiApiKey: string | null;
  geminiModel: string;
  maxDescriptionChars: number;
  maxItems: number;
  timeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  dailyLimit: number;
}

function integerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function providerEnv(): AiProviderName {
  const value = process.env.AI_PROVIDER?.trim().toLocaleLowerCase();

  if (value === 'mock' || value === 'gemini') {
    return value;
  }

  return 'disabled';
}

export function aiFoodParseConfig(): AiFoodParseConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

  return {
    provider: providerEnv(),
    geminiApiKey:
      geminiApiKey === undefined || geminiApiKey === '' ? null : geminiApiKey,
    geminiModel:
      process.env.GEMINI_FOOD_PARSE_MODEL?.trim() || 'gemini-2.5-flash',
    maxDescriptionChars: integerEnv('AI_FOOD_PARSE_MAX_DESCRIPTION_CHARS', 500),
    maxItems: integerEnv('AI_FOOD_PARSE_MAX_ITEMS', 8),
    timeoutMs: integerEnv('AI_FOOD_PARSE_TIMEOUT_MS', 8000),
    rateLimitWindowMs: integerEnv('AI_FOOD_PARSE_RATE_LIMIT_WINDOW', 600_000),
    rateLimitMax: integerEnv('AI_FOOD_PARSE_RATE_LIMIT_MAX', 5),
    dailyLimit: integerEnv('AI_FOOD_PARSE_DAILY_LIMIT', 25),
  };
}
