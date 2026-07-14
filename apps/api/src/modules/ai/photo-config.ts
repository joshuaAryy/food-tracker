import {
  PHOTO_CANDIDATE_ADJUDICATION_MAX_CANDIDATES,
  PHOTO_CANDIDATE_ADJUDICATION_MAX_OUTPUT_TOKENS,
  PHOTO_CANDIDATE_ADJUDICATION_MAX_ROWS,
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
  candidateAdjudicationEnabled: boolean;
  nutritionEstimationEnabled: boolean;
  candidateAdjudicationTimeoutMs: number;
  candidateAdjudicationMaxCandidates: number;
  candidateAdjudicationMaxRows: number;
  candidateAdjudicationMaxOutputTokens: number;
  candidateAdjudicationMockDecision:
    | 'select_candidate'
    | 'reject_all'
    | 'no_decision'
    | 'unavailable';
  nutritionEstimationMock: 'valid' | 'invalid' | 'missing' | 'unavailable';
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

function boundedCandidateAdjudicationOutputTokens(): number {
  const name = 'PHOTO_CANDIDATE_ADJUDICATION_MAX_OUTPUT_TOKENS';
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return PHOTO_CANDIDATE_ADJUDICATION_MAX_OUTPUT_TOKENS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 512 || parsed > 2048) {
    throw new Error(`${name} must be an integer between 512 and 2048.`);
  }
  return parsed;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function mockAdjudicationDecision(): PhotoAnalysisConfig['candidateAdjudicationMockDecision'] {
  const raw = process.env.PHOTO_CANDIDATE_ADJUDICATION_MOCK_DECISION?.trim();
  if (
    raw === 'select_candidate' ||
    raw === 'reject_all' ||
    raw === 'no_decision' ||
    raw === 'unavailable'
  ) {
    return raw;
  }
  return 'no_decision';
}

function mockNutritionEstimation(): PhotoAnalysisConfig['nutritionEstimationMock'] {
  const raw = process.env.PHOTO_NUTRITION_ESTIMATION_MOCK?.trim();
  if (
    raw === 'valid' ||
    raw === 'invalid' ||
    raw === 'missing' ||
    raw === 'unavailable'
  ) {
    return raw;
  }
  return 'missing';
}

export function photoAnalysisConfig(): PhotoAnalysisConfig {
  const textConfig = aiFoodParseConfig();
  const timeoutMs = positiveIntegerEnv('PHOTO_ANALYSIS_TIMEOUT_MS', 15_000);

  return {
    provider: textConfig.provider,
    geminiApiKey: textConfig.geminiApiKey,
    geminiModel:
      process.env.GEMINI_PHOTO_ANALYSIS_MODEL?.trim() || 'gemini-2.5-flash',
    maxItems: Math.min(
      positiveIntegerEnv('PHOTO_ANALYSIS_MAX_ITEMS', PHOTO_ANALYSIS_MAX_ITEMS),
      PHOTO_ANALYSIS_MAX_ITEMS,
    ),
    timeoutMs,
    rateLimitWindowMs: positiveIntegerEnv(
      'PHOTO_ANALYSIS_RATE_LIMIT_WINDOW_MS',
      600_000,
    ),
    rateLimitMax: positiveIntegerEnv('PHOTO_ANALYSIS_RATE_LIMIT_MAX', 5),
    dailyLimit: positiveIntegerEnv('PHOTO_ANALYSIS_DAILY_LIMIT', 25),
    maxBytes: PHOTO_ANALYSIS_MAX_BYTES,
    maxOutputTokens: boundedPhotoOutputTokens(),
    candidateAdjudicationEnabled: booleanEnv(
      'PHOTO_CANDIDATE_ADJUDICATION_ENABLED',
      false,
    ),
    nutritionEstimationEnabled: booleanEnv(
      'PHOTO_NUTRITION_ESTIMATION_ENABLED',
      false,
    ),
    candidateAdjudicationTimeoutMs: Math.min(
      positiveIntegerEnv('PHOTO_CANDIDATE_ADJUDICATION_TIMEOUT_MS', 2_500),
      Math.max(250, timeoutMs - 1_000),
    ),
    candidateAdjudicationMaxCandidates: Math.min(
      positiveIntegerEnv(
        'PHOTO_CANDIDATE_ADJUDICATION_MAX_CANDIDATES',
        PHOTO_CANDIDATE_ADJUDICATION_MAX_CANDIDATES,
      ),
      PHOTO_CANDIDATE_ADJUDICATION_MAX_CANDIDATES,
    ),
    candidateAdjudicationMaxRows: Math.min(
      positiveIntegerEnv(
        'PHOTO_CANDIDATE_ADJUDICATION_MAX_ROWS',
        PHOTO_CANDIDATE_ADJUDICATION_MAX_ROWS,
      ),
      PHOTO_CANDIDATE_ADJUDICATION_MAX_ROWS,
    ),
    candidateAdjudicationMaxOutputTokens:
      boundedCandidateAdjudicationOutputTokens(),
    candidateAdjudicationMockDecision: mockAdjudicationDecision(),
    nutritionEstimationMock: mockNutritionEstimation(),
  };
}
