import { Router } from 'express';
import {
  analyticsMetricCatalogSchema,
  analyticsMetricIsAvailableInMode,
  analyticsMetricsForMode,
  analyticsContributorsQueryInputSchema,
  trendQueryInputSchema,
  type TrendQueryInput,
} from '@food-tracker/shared';
import { currentUserId } from '../../../lib/auth.js';
import { AppError } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { sendSuccess } from '../../../lib/responses.js';
import { validateBody, validatedBody } from '../../../middleware/validate.js';
import { computeCanonicalTrend, createTrendRequestContext } from './service.js';
import { resolveComparisonStrategy } from './comparisons.js';
import { computeAnalyticsContributors } from './contributors.js';

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
  '/contributors',
  validateBody(analyticsContributorsQueryInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const contributorQuery = validatedBody<
      TrendQueryInput & { includeAll?: boolean }
    >(response);
    const { includeAll, ...query } = contributorQuery;
    const mode = await currentTrackingMode(userId);
    if (!analyticsMetricIsAvailableInMode(query.primaryMetric, mode)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Metric is unavailable in this tracking mode',
      );
    }
    sendSuccess(
      response,
      await computeAnalyticsContributors(
        userId,
        query,
        includeAll === undefined ? {} : { includeAll },
      ),
    );
  },
);

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
      query.comparisonMetric !== undefined &&
      resolveComparisonStrategy(query.primaryMetric, query.comparisonMetric) ===
        'incompatible'
    ) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'These metrics do not support comparison',
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
  const context = createTrendRequestContext(userId, keys);
  const trends = await Promise.all(
    keys.map(
      async (primaryMetric) =>
        [
          primaryMetric,
          await computeCanonicalTrend(
            userId,
            { ...baseQuery, primaryMetric },
            context,
          ),
        ] as const,
    ),
  );
  sendSuccess(response, {
    mode,
    period,
    sections: Object.fromEntries(trends),
  });
});
