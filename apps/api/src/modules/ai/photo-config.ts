import {
  PHOTO_ANALYSIS_MAX_ITEMS,
  PHOTO_ANALYSIS_MAX_BYTES,
} from '@food-tracker/shared';
import { aiFoodParseConfig, type AiProviderName } from './config.js';

export interface PhotoAnalysisConfig {
  provider: AiProviderName;
  geminiApiKey: string | null;
  geminiModel: string;
  maxItems: number;
  timeoutMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  dailyLimit: number;
  maxBytes: number;
  maxOutputTokens: number;
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function boundedPhotoOutputTokens(): number {
  const name = 'PHOTO_ANALYSIS_MAX_OUTPUT_TOKENS';
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return 2048;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 2048 || parsed > 4096) {
    throw new Error(`${name} must be an integer between 2048 and 4096.`);
  }
  return parsed;
}

export function photoAnalysisConfig(): PhotoAnalysisConfig {
  const textConfig = aiFoodParseConfig();

  return {
    provider: textConfig.provider,
    geminiApiKey: textConfig.geminiApiKey,
    geminiModel:
      process.env.GEMINI_PHOTO_ANALYSIS_MODEL?.trim() || 'gemini-2.5-flash',
    maxItems: Math.min(
      positiveIntegerEnv('PHOTO_ANALYSIS_MAX_ITEMS', PHOTO_ANALYSIS_MAX_ITEMS),
      PHOTO_ANALYSIS_MAX_ITEMS,
    ),
    timeoutMs: positiveIntegerEnv('PHOTO_ANALYSIS_TIMEOUT_MS', 15_000),
    rateLimitWindowMs: positiveIntegerEnv(
      'PHOTO_ANALYSIS_RATE_LIMIT_WINDOW_MS',
      600_000,
    ),
    rateLimitMax: positiveIntegerEnv('PHOTO_ANALYSIS_RATE_LIMIT_MAX', 5),
    dailyLimit: positiveIntegerEnv('PHOTO_ANALYSIS_DAILY_LIMIT', 25),
    maxBytes: PHOTO_ANALYSIS_MAX_BYTES,
    maxOutputTokens: boundedPhotoOutputTokens(),
  };
}
