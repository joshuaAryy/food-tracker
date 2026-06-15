import { Router } from 'express';
import { mockTrackingPreferences } from '../../lib/mock-data.js';
import { sendSuccess } from '../../lib/responses.js';

export const trackingPreferencesRouter = Router();

trackingPreferencesRouter.get('/', (_request, response) =>
  sendSuccess(response, mockTrackingPreferences),
);
trackingPreferencesRouter.put('/', (_request, response) =>
  sendSuccess(response, mockTrackingPreferences),
);
