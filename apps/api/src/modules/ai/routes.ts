import express, { Router } from 'express';
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
import { foodParseProvider, nutritionEstimateProvider } from './provider.js';
import { assertAiFoodParseLimit } from './rate-limit.js';
import { retrieveParsedFoodItems } from './retrieval.js';
import { photoAnalysisConfig } from './photo-config.js';
import { analyzePhotoFood } from './photo-analysis.js';

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
  const rateLimitKey = `${userId}:${request.ip ?? 'unknown'}:photo-analysis`;
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
    const result = await analyzePhotoFood({
      image: body,
      userId,
      rateLimitKey,
      signal: controller.signal,
      config,
    });
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
