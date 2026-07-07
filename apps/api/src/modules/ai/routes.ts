import { Router } from 'express';
import {
  aiFoodParseInputSchema,
  type AiFoodParseInput,
} from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { AppError } from '../../lib/errors.js';
import { sendSuccess } from '../../lib/responses.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';
import { aiFoodParseConfig } from './config.js';
import { foodParseProvider } from './provider.js';
import { assertAiFoodParseLimit } from './rate-limit.js';
import { retrieveParsedFoodItems } from './retrieval.js';

export const aiRouter = Router();

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
