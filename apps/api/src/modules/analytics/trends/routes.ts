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
export const insightsRouter = Router();

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
    if (
      ![
        'calories',
        'protein',
        'carbs',
        'fat',
        'macroComposition',
        'weight',
        'loggingConsistency',
        'hydration',
      ].includes(query.primaryMetric)
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Metric is not yet available in canonical Trends',
      );
    }

    sendSuccess(response, await computeCanonicalTrend(userId, query));
  },
);

insightsRouter.get('/', async (request, response) => {
  const userId = currentUserId(response);
  const mode = await currentTrackingMode(userId);
  const period = request.query.period === 'month' ? 'month' : 'week';
  const days = period === 'month' ? 30 : 7;
  const baseQuery = {
    period: { kind: 'relative' as const, days },
    aggregation: 'automatic' as const,
    visualization: 'automatic' as const,
    showReference: true,
    coverageFilter: 'all_logged_days' as const,
  };
  const keys = [
    'calories',
    'protein',
    'carbs',
    'fat',
    'macroComposition',
    'weight',
    'hydration',
    'loggingConsistency',
  ] as const;
  const trends = await Promise.all(
    keys.map(
      async (primaryMetric) =>
        [
          primaryMetric,
          await computeCanonicalTrend(userId, { ...baseQuery, primaryMetric }),
        ] as const,
    ),
  );
  sendSuccess(response, {
    mode,
    period,
    sections: Object.fromEntries(trends),
  });
});
