import { Router } from 'express';
import {
  type AiFoodParseCandidate,
  type AiFoodParsedItem,
  aiFoodParseInputSchema,
  aiNutritionEstimateInputSchema,
  type AiFoodParseInput,
  type AiNutritionEstimateInput,
} from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { AppError } from '../../lib/errors.js';
import { sendSuccess } from '../../lib/responses.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';
import { aiFoodParseConfig } from './config.js';
import { foodParseProvider, nutritionEstimateProvider } from './provider.js';
import { assertAiFoodParseLimit } from './rate-limit.js';
import { retrieveParsedFoodItems } from './retrieval.js';

export const aiRouter = Router();

const GENERIC_FOOD_WORDS = new Set([
  'bowl',
  'plate',
  'serving',
  'homemade',
  'custom',
  'meal',
  'food',
  'dish',
  'portion',
  'with',
  'and',
]);

function normalizeToken(value: string): string {
  const normalized = value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length > 3 && normalized.endsWith('ies')) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (normalized.length > 2 && normalized.endsWith('s')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(
    value
      .split(/\s+/)
      .map(normalizeToken)
      .filter((token) => token.length >= 2 && !GENERIC_FOOD_WORDS.has(token)),
  );
}

function candidateName(candidate: AiFoodParseCandidate): string {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem.name
    : candidate.externalFood.name;
}

function hasMeaningfulOverlap(
  parsedName: string,
  candidate: AiFoodParseCandidate,
): boolean {
  const parsedTokens = meaningfulTokens(parsedName);
  if (parsedTokens.size === 0) return false;

  const candidateTokens = meaningfulTokens(candidateName(candidate));
  for (const token of parsedTokens) {
    if (candidateTokens.has(token)) return true;
  }

  return false;
}

function hasRelevantTrustedCandidate(
  row: AiFoodParsedItem | undefined,
): boolean {
  if (row === undefined || !row.loggable || row.selectedCandidateId === null) {
    return false;
  }

  const selectedCandidate = row.candidates.find((candidate) => {
    const candidateId =
      candidate.candidateType === 'food_item'
        ? candidate.foodItem.id
        : `${candidate.externalFood.sourceProvider}:${candidate.externalFood.sourceId}`;
    return candidateId === row.selectedCandidateId;
  });

  if (selectedCandidate === undefined) return false;
  if (selectedCandidate.confidence === 'low') return false;

  return hasMeaningfulOverlap(row.parsedName, selectedCandidate);
}

aiRouter.post(
  '/food-parse',
  validateBody(aiFoodParseInputSchema),
  async (request, response) => {
    const userId = currentUserId(response);
    const config = aiFoodParseConfig();
    const input = validatedBody<AiFoodParseInput>(response);

    if (input.description.length > config.maxDescriptionChars) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Description must be ${config.maxDescriptionChars} characters or fewer.`,
      );
    }

    const rateLimitKey = `${userId}:${request.ip ?? 'unknown'}`;
    assertAiFoodParseLimit({
      key: rateLimitKey,
      windowMs: config.rateLimitWindowMs,
      windowMax: config.rateLimitMax,
      dailyMax: config.dailyLimit,
    });

    const provider = foodParseProvider(config);
    const parsedItems = (await provider.parse(input.description)).slice(
      0,
      config.maxItems,
    );
    const items = await retrieveParsedFoodItems({
      userId,
      rateLimitKey,
      parsedItems,
    });

    sendSuccess(response, {
      description: input.description,
      items,
    });
  },
);

aiRouter.post(
  '/nutrition-estimate',
  validateBody(aiNutritionEstimateInputSchema),
  async (request, response) => {
    const userId = currentUserId(response);
    const config = aiFoodParseConfig();
    const input = validatedBody<AiNutritionEstimateInput>(response);
    const rateLimitKey = `${userId}:${request.ip ?? 'unknown'}:nutrition-estimate`;

    assertAiFoodParseLimit({
      key: rateLimitKey,
      windowMs: config.rateLimitWindowMs,
      windowMax: config.rateLimitMax,
      dailyMax: config.dailyLimit,
    });

    const [row] = await retrieveParsedFoodItems({
      userId,
      rateLimitKey,
      parsedItems: [
        {
          name: input.parsedName,
          quantityText: input.quantityText ?? null,
          servingText: input.servingText ?? null,
        },
      ],
    });

    if (hasRelevantTrustedCandidate(row)) {
      throw new AppError(
        409,
        'TRUSTED_NUTRITION_AVAILABLE',
        'Trusted nutrition is available for this food. Review the trusted match instead.',
      );
    }

    const provider = nutritionEstimateProvider(config);
    const estimate = await provider.estimate({
      parsedName: input.parsedName,
      quantityText: input.quantityText ?? null,
      servingText: input.servingText ?? null,
      description: input.description ?? null,
    });

    sendSuccess(response, {
      source: 'ai_estimate',
      trustLevel: 'low',
      ...estimate,
      nutrients: {},
    });
  },
);
