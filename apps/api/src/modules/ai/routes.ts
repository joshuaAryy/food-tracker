import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  type AiFoodParsedItem,
  aiFoodParseInputSchema,
  aiNutritionEstimateInputSchema,
  PHOTO_ANALYSIS_JPEG_MIME_TYPE,
  PHOTO_ANALYSIS_MAX_BYTES,
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
import {
  foodParseProvider,
  nutritionEstimateProvider,
  type FoodParseEvaluationDecision,
} from './provider.js';
import { assertAiFoodParseLimit } from './rate-limit.js';
import { createRequestRateLimitKey } from './rate-limit-key.js';
import { retrieveParsedFoodItems } from './retrieval.js';
import { photoAnalysisConfig } from './photo-config.js';
import { analyzePhotoFood } from './photo-analysis.js';
import { runPhotoAnalysisWithId } from './photo-diagnostics.js';

const photoRawBody = express.raw({
  type: PHOTO_ANALYSIS_JPEG_MIME_TYPE,
  limit: PHOTO_ANALYSIS_MAX_BYTES,
});

function isJpegMagicBytes(value: unknown): value is Buffer {
  return (
    Buffer.isBuffer(value) &&
    value.length >= 3 &&
    value[0] === 0xff &&
    value[1] === 0xd8 &&
    value[2] === 0xff
  );
}

export const aiRouter = Router();

aiRouter.post('/photo-analysis', photoRawBody, async (request, response) => {
  const contentType = request.get('content-type');
  if (contentType !== PHOTO_ANALYSIS_JPEG_MIME_TYPE) {
    throw new AppError(
      415,
      'UNSUPPORTED_IMAGE_TYPE',
      'Photo analysis accepts only image/jpeg uploads.',
    );
  }

  const body = request.body;
  if (!Buffer.isBuffer(body) || body.length === 0 || !isJpegMagicBytes(body)) {
    throw new AppError(
      400,
      'INVALID_IMAGE',
      'The uploaded image is empty or is not a valid JPEG.',
    );
  }
  if (body.length > PHOTO_ANALYSIS_MAX_BYTES) {
    throw new AppError(
      413,
      'IMAGE_TOO_LARGE',
      'The uploaded image is larger than 5 MiB.',
    );
  }

  const userId = currentUserId(response);
  const config = photoAnalysisConfig();
  const rateLimitKey = createRequestRateLimitKey({
    userId,
    networkIdentifier: request.ip,
    scope: 'photo-analysis',
  });
  assertAiFoodParseLimit({
    key: rateLimitKey,
    windowMs: config.rateLimitWindowMs,
    windowMax: config.rateLimitMax,
    dailyMax: config.dailyLimit,
    message: 'Photo analysis is temporarily limited. Try again later.',
  });

  const controller = new AbortController();
  const abortOnDisconnect = () => {
    if (!response.writableEnded) controller.abort();
  };
  request.once('aborted', abortOnDisconnect);
  response.once('close', abortOnDisconnect);

  try {
    const analysisId = randomUUID();
    const result = await runPhotoAnalysisWithId(analysisId, () =>
      analyzePhotoFood({
        image: body,
        userId,
        rateLimitKey,
        signal: controller.signal,
        config,
      }),
    );
    sendSuccess(response, result);
  } finally {
    request.off('aborted', abortOnDisconnect);
    response.off('close', abortOnDisconnect);
  }
});

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

function applyFoodParseEvaluation(
  items: AiFoodParsedItem[],
  decisions: FoodParseEvaluationDecision[],
): AiFoodParsedItem[] {
  const itemIds = new Set(items.map((item) => item.id));
  const decisionIds = decisions.map((decision) => decision.itemId);
  if (
    decisions.length !== items.length ||
    new Set(decisionIds).size !== decisions.length ||
    decisionIds.some((itemId) => !itemIds.has(itemId)) ||
    items.some((item) => !decisionIds.includes(item.id))
  ) {
    throw new AppError(
      503,
      'AI_UNAVAILABLE',
      'AI food adequacy evaluation returned incomplete decisions.',
    );
  }

  const decisionByItemId = new Map(
    decisions.map((decision) => [decision.itemId, decision]),
  );

  return items.map((item) => {
    const decision = decisionByItemId.get(item.id);
    if (decision === undefined) return item;

    if (decision.decision === 'fallback') {
      return {
        ...item,
        reviewStatus: 'unmatched',
        loggable: false,
        selectedCandidateId: null,
      };
    }

    const selectedCandidateId =
      decision.selectedCandidateId ?? item.selectedCandidateId;
    const selectedCandidate = item.candidates.find(
      (candidate) => parseCandidateId(candidate) === selectedCandidateId,
    );

    if (selectedCandidate === undefined) {
      return {
        ...item,
        reviewStatus: 'needs_review',
        loggable: false,
        selectedCandidateId: null,
      };
    }

    const evaluatedItem = {
      ...item,
      selectedCandidateId,
      loggable: true,
      reviewStatus:
        decision.decision === 'trusted' &&
        selectedCandidate.candidateType === 'food_item' &&
        rowHasRelevantTrustedCandidate({
          ...item,
          selectedCandidateId,
        })
          ? ('matched' as const)
          : ('needs_review' as const),
    };

    return evaluatedItem;
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

    const rateLimitKey = createRequestRateLimitKey({
      userId,
      networkIdentifier: request.ip,
      scope: 'food-parse',
    });
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
    const retrievedItems = await retrieveParsedFoodItems({
      userId,
      rateLimitKey,
      parsedItems,
    });
    const items =
      provider.evaluate === undefined
        ? retrievedItems
        : applyFoodParseEvaluation(
            retrievedItems,
            await provider.evaluate({
              description: input.description,
              items: retrievedItems,
            }),
          );

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
    const rateLimitKey = createRequestRateLimitKey({
      userId,
      networkIdentifier: request.ip,
      scope: 'nutrition-estimate',
    });

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
