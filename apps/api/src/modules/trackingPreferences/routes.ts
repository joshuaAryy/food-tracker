import { Router } from 'express';
import {
  trackingPreferencesSchema,
  type TrackingPreferences,
} from '@food-tracker/shared';
import { currentUserId } from '../../lib/auth.js';
import { notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { validateBody, validatedBody } from '../../middleware/validate.js';

export const trackingPreferencesRouter = Router();

trackingPreferencesRouter.get('/', async (_request, response) => {
  const preferences = await prisma.trackingPreference.findUnique({
    where: { userId: currentUserId(response) },
  });

  if (preferences === null) {
    throw notFoundError('Tracking preferences');
  }

  sendSuccess(response, {
    mode: preferences.mode,
    waterTrackingEnabled: preferences.waterTrackingEnabled,
  });
});

trackingPreferencesRouter.put(
  '/',
  validateBody(trackingPreferencesSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<TrackingPreferences>(response);
    const preferences = await prisma.trackingPreference.upsert({
      where: { userId },
      update: input,
      create: { userId, ...input },
    });

    sendSuccess(response, {
      mode: preferences.mode,
      waterTrackingEnabled: preferences.waterTrackingEnabled,
    });
  },
);
