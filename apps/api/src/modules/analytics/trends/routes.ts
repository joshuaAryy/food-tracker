import { Router } from 'express';
import {
  ANALYTICS_OVERVIEW_KEYS,
  canonicalInsightsResponseV2WithOverviewSchema,
  analyticsMetricCatalogSchema,
  analyticsMetricIsAvailableInMode,
  analyticsMetricsForMode,
  analyticsContributorsQueryInputSchema,
  trendQueryInputSchema,
  type TrendQueryInput,
  type AnalyticsSectionFailure,
  type AnalyticsSectionResult,
  type AnalyticsOverviewResultMap,
} from '@food-tracker/shared';
import { currentUserId } from '../../../lib/auth.js';
import { AppError } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { sendSuccess } from '../../../lib/responses.js';
import { validateBody, validatedBody } from '../../../middleware/validate.js';
import { computeCanonicalTrend, createTrendRequestContext } from './service.js';
import { resolveComparisonStrategy } from './comparisons.js';
import { computeAnalyticsContributors } from './contributors.js';
import {
  computeInsightsOverview,
  type InsightsOverviewDependencies,
} from './overview.js';
import {
  emitInsightsDiagnostic,
  insightsDiagnosticErrorDetails,
  insightsDiagnosticsEnabled,
  type InsightsDiagnosticCategory,
  type InsightsDiagnosticDetails,
  type InsightsPeriod,
  type InsightsTrackingMode,
} from './insights-diagnostics.js';

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

export interface InsightsRouteDependencies {
  currentTrackingMode?: typeof currentTrackingMode;
  createTrendRequestContext?: typeof createTrendRequestContext;
  computeCanonicalTrend?: typeof computeCanonicalTrend;
  computeOverview?: typeof computeInsightsOverview;
  overviewDependencies?: InsightsOverviewDependencies;
  emitDiagnostic?: (
    category: InsightsDiagnosticCategory,
    details: InsightsDiagnosticDetails,
  ) => void;
}

export function createInsightsRouter(
  dependencies: InsightsRouteDependencies = {},
): Router {
  const resolveTrackingMode =
    dependencies.currentTrackingMode ?? currentTrackingMode;
  const createContext =
    dependencies.createTrendRequestContext ?? createTrendRequestContext;
  const computeTrend =
    dependencies.computeCanonicalTrend ?? computeCanonicalTrend;
  const computeOverview =
    dependencies.computeOverview ?? computeInsightsOverview;
  const emitDiagnostic = dependencies.emitDiagnostic ?? emitInsightsDiagnostic;
  const report = (
    category: InsightsDiagnosticCategory,
    details: InsightsDiagnosticDetails,
  ): void => {
    if (!insightsDiagnosticsEnabled()) return;
    emitDiagnostic(category, details);
  };
  const router = Router();

  router.get('/', async (request, response) => {
    const requestId = response.locals.requestId as string | undefined;
    const period: InsightsPeriod =
      request.query.period === 'month' ? 'month' : 'week';
    const baseDetails = { requestId, period };
    report('insights_route_started', baseDetails);
    const userId = currentUserId(response);
    const modeDetails = { ...baseDetails };
    report('insights_tracking_mode_started', modeDetails);
    let mode: InsightsTrackingMode;
    try {
      mode = await resolveTrackingMode(userId);
    } catch (error) {
      report('insights_tracking_mode_failed', {
        ...modeDetails,
        ...insightsDiagnosticErrorDetails(error),
      });
      throw error;
    }
    report('insights_tracking_mode_succeeded', {
      ...modeDetails,
      trackingMode: mode,
    });

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

    report('insights_context_started', {
      ...baseDetails,
      trackingMode: mode,
    });
    let context: ReturnType<typeof createTrendRequestContext>;
    try {
      context = createContext(userId, keys);
    } catch (error) {
      report('insights_context_failed', {
        ...baseDetails,
        trackingMode: mode,
        ...insightsDiagnosticErrorDetails(error),
      });
      throw error;
    }
    if (context.base !== undefined) {
      void context.base
        .then(() => {
          report('insights_context_succeeded', {
            ...baseDetails,
            trackingMode: mode,
          });
        })
        .catch((error: unknown) => {
          report('insights_context_failed', {
            ...baseDetails,
            trackingMode: mode,
            ...insightsDiagnosticErrorDetails(error),
          });
        });
    } else {
      report('insights_context_succeeded', {
        ...baseDetails,
        trackingMode: mode,
      });
    }

    if (context.base !== undefined) {
      await context.base;
    }

    const failedSection: AnalyticsSectionFailure = {
      status: 'failed',
      code: 'section_unavailable',
      retryable: true,
    };
    const fetchedAt = new Date().toISOString();
    const trends = await Promise.all(
      keys.map(async (primaryMetric) => {
        report('insights_metric_started', {
          ...baseDetails,
          trackingMode: mode,
          metric: primaryMetric,
        });
        try {
          const trend = await computeTrend(
            userId,
            { ...baseQuery, primaryMetric },
            context,
          );
          report('insights_metric_succeeded', {
            ...baseDetails,
            trackingMode: mode,
            metric: primaryMetric,
          });
          return [
            primaryMetric,
            {
              status: 'available' as const,
              data: trend,
              fetchedAt,
            } satisfies AnalyticsSectionResult,
          ] as const;
        } catch (error) {
          report('insights_metric_failed', {
            ...baseDetails,
            trackingMode: mode,
            metric: primaryMetric,
            ...insightsDiagnosticErrorDetails(error),
          });
          return [primaryMetric, failedSection] as const;
        }
      }),
    );
    const overview: AnalyticsOverviewResultMap =
      context.base === undefined && dependencies.computeOverview === undefined
        ? (Object.fromEntries(
            ANALYTICS_OVERVIEW_KEYS.map((key) => [key, failedSection]),
          ) as AnalyticsOverviewResultMap)
        : await computeOverview(
            userId,
            period,
            context,
            dependencies.overviewDependencies,
          );
    report('insights_computation_succeeded', {
      ...baseDetails,
      trackingMode: mode,
    });

    report('insights_response_send_started', {
      ...baseDetails,
      trackingMode: mode,
    });
    try {
      sendSuccess(
        response,
        canonicalInsightsResponseV2WithOverviewSchema.parse({
          contractVersion: 2,
          mode,
          period,
          sections: Object.fromEntries(trends),
          overview,
        }),
      );
    } catch (error) {
      report('insights_response_send_failed', {
        ...baseDetails,
        trackingMode: mode,
        ...insightsDiagnosticErrorDetails(error),
      });
      throw error;
    }
    report('insights_response_send_succeeded', {
      ...baseDetails,
      trackingMode: mode,
    });
  });

  return router;
}

export const insightsRouter = createInsightsRouter();
