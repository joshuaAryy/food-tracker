import { Router } from 'express';
import {
  analyticsMetricCatalogSchema,
  analyticsMetricIsAvailableInMode,
  analyticsMetricsForMode,
  trendQueryInputSchema,
  type TrendQueryInput,
} from '@food-tracker/shared';
import { currentUserId } from '../../../lib/auth.js';
import { AppError } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { sendSuccess } from '../../../lib/responses.js';
import { validateBody, validatedBody } from '../../../middleware/validate.js';
import { computeCanonicalTrend } from './service.js';

export const trendsRouter = Router();

async function currentTrackingMode(
  userId: string,
): Promise<'simple' | 'complex'> {
  const preferences = await prisma.trackingPreference.findUnique({
    where: { userId },
    select: { mode: true },
  });
  return preferences?.mode ?? 'simple';
}

trendsRouter.get('/catalog', async (_request, response) => {
  const mode = await currentTrackingMode(currentUserId(response));
  sendSuccess(response, {
    mode,
    metrics: analyticsMetricCatalogSchema.parse(analyticsMetricsForMode(mode)),
  });
});

trendsRouter.post(
  '/query',
  validateBody(trendQueryInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const query = validatedBody<TrendQueryInput>(response);
    const mode = await currentTrackingMode(userId);
    if (!analyticsMetricIsAvailableInMode(query.primaryMetric, mode)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Metric is unavailable in this tracking mode',
      );
    }
    if (
      query.comparisonMetric !== undefined &&
      !analyticsMetricIsAvailableInMode(query.comparisonMetric, mode)
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Comparison metric is unavailable in this tracking mode',
      );
    }
    if (query.primaryMetric !== 'calories') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Metric is not yet available in canonical Trends',
      );
    }

    sendSuccess(response, await computeCanonicalTrend(userId, query));
  },
);
