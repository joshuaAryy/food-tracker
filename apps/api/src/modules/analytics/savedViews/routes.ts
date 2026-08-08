import { Router } from 'express';
import {
  analyticsPreferenceUpdateSchema,
  analyticsSavedViewCreateSchema,
  analyticsSavedViewOrderSchema,
  analyticsSavedViewParamsSchema,
  analyticsSavedViewUpdateSchema,
  type AnalyticsPreferenceUpdateInput,
  type AnalyticsSavedViewCreateInput,
  type AnalyticsSavedViewOrderInput,
  type AnalyticsSavedViewUpdateInput,
} from '@food-tracker/shared';
import { currentUserId } from '../../../lib/auth.js';
import { sendSuccess } from '../../../lib/responses.js';
import {
  validateBody,
  validateParams,
  validatedBody,
  validatedParams,
} from '../../../middleware/validate.js';
import {
  createAnalyticsSavedView,
  deleteAnalyticsSavedView,
  duplicateAnalyticsSavedView,
  getAnalyticsPreferences,
  listAnalyticsSavedViews,
  reorderAnalyticsSavedViews,
  requireComplexAnalyticsMode,
  updateAnalyticsPreferences,
  updateAnalyticsSavedView,
} from './service.js';

export const analyticsSavedViewsRouter = Router();
export const analyticsPreferencesRouter = Router();

analyticsSavedViewsRouter.use(async (_request, response, next) => {
  try {
    await requireComplexAnalyticsMode(currentUserId(response));
    next();
  } catch (error) {
    next(error);
  }
});

analyticsPreferencesRouter.get('/', async (_request, response) => {
  sendSuccess(response, {
    preferences: await getAnalyticsPreferences(currentUserId(response)),
  });
});

analyticsPreferencesRouter.put(
  '/',
  validateBody(analyticsPreferenceUpdateSchema),
  async (_request, response) => {
    sendSuccess(response, {
      preferences: await updateAnalyticsPreferences(
        currentUserId(response),
        validatedBody<AnalyticsPreferenceUpdateInput>(response),
      ),
    });
  },
);

analyticsSavedViewsRouter.get('/', async (_request, response) => {
  sendSuccess(response, {
    savedViews: await listAnalyticsSavedViews(currentUserId(response)),
  });
});

analyticsSavedViewsRouter.post(
  '/',
  validateBody(analyticsSavedViewCreateSchema),
  async (_request, response) => {
    const savedView = await createAnalyticsSavedView(
      currentUserId(response),
      validatedBody<AnalyticsSavedViewCreateInput>(response),
    );
    response.status(201);
    sendSuccess(response, { savedView });
  },
);

analyticsSavedViewsRouter.put(
  '/order',
  validateBody(analyticsSavedViewOrderSchema),
  async (_request, response) => {
    sendSuccess(response, {
      savedViews: await reorderAnalyticsSavedViews(
        currentUserId(response),
        validatedBody<AnalyticsSavedViewOrderInput>(response),
      ),
    });
  },
);

analyticsSavedViewsRouter.patch(
  '/:id',
  validateParams(analyticsSavedViewParamsSchema),
  validateBody(analyticsSavedViewUpdateSchema),
  async (_request, response) => {
    const savedView = await updateAnalyticsSavedView(
      currentUserId(response),
      validatedParams<{ id: string }>(response).id,
      validatedBody<AnalyticsSavedViewUpdateInput>(response),
    );
    sendSuccess(response, { savedView });
  },
);

analyticsSavedViewsRouter.post(
  '/:id/duplicate',
  validateParams(analyticsSavedViewParamsSchema),
  async (_request, response) => {
    const savedView = await duplicateAnalyticsSavedView(
      currentUserId(response),
      validatedParams<{ id: string }>(response).id,
    );
    response.status(201);
    sendSuccess(response, { savedView });
  },
);

analyticsSavedViewsRouter.delete(
  '/:id',
  validateParams(analyticsSavedViewParamsSchema),
  async (_request, response) => {
    const id = validatedParams<{ id: string }>(response).id;
    await deleteAnalyticsSavedView(currentUserId(response), id);
    sendSuccess(response, { id, deleted: true });
  },
);
