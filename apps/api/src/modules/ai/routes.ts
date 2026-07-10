import { Router } from 'express';
import {
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
import {
  hasRelevantTrustedCandidate,
  parseCandidateId,
} from '../foodItems/candidate-ranking.js';
import { aiFoodParseConfig } from './config.js';
import { foodParseProvider, nutritionEstimateProvider } from './provider.js';
import { assertAiFoodParseLimit } from './rate-limit.js';
import { retrieveParsedFoodItems } from './retrieval.js';

export const aiRouter = Router();

function rowHasRelevantTrustedCandidate(
  row: AiFoodParsedItem | undefined,
): boolean {
  if (row === undefined || !row.loggable || row.selectedCandidateId === null) {
    return false;
  }

  const selectedCandidate = row.candidates.find((candidate) => {
    return parseCandidateId(candidate) === row.selectedCandidateId;
  });

  return hasRelevantTrustedCandidate({
    parsedName: row.parsedName,
    candidate: selectedCandidate,
  });
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

    if (rowHasRelevantTrustedCandidate(row)) {
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
