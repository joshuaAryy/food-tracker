import {
  ANALYTICS_INSIGHTS_SECTION_KEYS,
  ANALYTICS_OVERVIEW_KEYS,
  type AnalyticsMetricKey,
  type AnalyticsOverviewResultMap,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestContext } from '../src/middleware/request-context.js';
import {
  createInsightsRouter,
  type InsightsRouteDependencies,
} from '../src/modules/analytics/trends/routes.js';

function trend(primaryMetric: AnalyticsMetricKey): CanonicalTrendResponse {
  const unit =
    primaryMetric === 'weight'
      ? 'lb'
      : primaryMetric === 'hydration'
        ? 'mL'
        : primaryMetric === 'loggingConsistency'
          ? 'percent'
          : primaryMetric === 'macroComposition'
            ? 'composition'
            : primaryMetric === 'calories'
              ? 'kcal'
              : 'g';
  return {
    timezone: 'America/Toronto',
    trackingMode: 'simple',
    primaryMetric,
    aggregation: 'daily',
    resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
    firstEligibleDate: null,
    today: '2026-08-07',
    reference: { kind: 'none', unit, reason: 'not_configured' },
    interpretation: null,
    relatedMetrics: [],
    points: [],
    summary: { numericDayCount: 0, average: null },
  };
}

function failedOverview(): AnalyticsOverviewResultMap {
  return Object.fromEntries(
    ANALYTICS_OVERVIEW_KEYS.map((key) => [
      key,
      { status: 'failed', code: 'section_unavailable', retryable: true },
    ]),
  ) as AnalyticsOverviewResultMap;
}

describe('canonical Insights transport and overview fault boundaries', () => {
  it('keeps a core trend failure at the report-level until the v2 route is live', async () => {
    const context = {} as ReturnType<
      NonNullable<InsightsRouteDependencies['createTrendRequestContext']>
    >;
    const app = express();
    app.use(
      requestContext({ createRequestId: () => 'req_insights_resilience_test' }),
    );
    app.use((_request, response, next) => {
      response.locals.userId = '00000000-0000-0000-0000-000000000001';
      next();
    });
    app.use(
      '/api/v1/analytics/insights',
      createInsightsRouter({
        currentTrackingMode: async () => 'simple',
        createTrendRequestContext: () => context,
        computeCanonicalTrend: async (_userId, query) => {
          if (query.primaryMetric === 'hydration') {
            throw new Error('hydration calculator failed');
          }
          return trend(query.primaryMetric);
        },
        computeOverview: async () => failedOverview(),
      } as InsightsRouteDependencies & {
        computeOverview: NonNullable<unknown>;
      }),
    );
    app.use(errorHandler);

    const response = await request(app)
      .get('/api/v1/analytics/insights?period=week')
      .expect(500);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The request could not be completed.',
        details: {},
      },
    });
  });

  it('isolates a failed core section in the v2 transport contract', async () => {
    const context = {} as ReturnType<
      NonNullable<InsightsRouteDependencies['createTrendRequestContext']>
    >;
    const app = express();
    app.use(
      requestContext({ createRequestId: () => 'req_v2_section_failure' }),
    );
    app.use((_request, response, next) => {
      response.locals.userId = '00000000-0000-0000-0000-000000000001';
      next();
    });
    app.use(
      '/api/v1/analytics/insights',
      createInsightsRouter({
        currentTrackingMode: async () => 'simple',
        createTrendRequestContext: () => context,
        computeCanonicalTrend: async (_userId, query) => {
          if (query.primaryMetric === 'hydration') {
            throw new Error('hydration calculator failed');
          }
          return trend(query.primaryMetric);
        },
        computeOverview: async () => failedOverview(),
      }),
    );
    app.use(errorHandler);

    const response = await request(app)
      .get('/api/v1/analytics/insights?period=week&contractVersion=2')
      .expect(200);

    expect(response.body.data.contractVersion).toBe(2);
    expect(response.body.data.sections.hydration).toEqual({
      status: 'failed',
      code: 'section_unavailable',
      retryable: true,
    });
    expect(response.body.data.sections.calories).toMatchObject({
      status: 'available',
      data: { primaryMetric: 'calories' },
    });
  });

  it('isolates every core section failure in the v2 response while healthy siblings survive', async () => {
    for (const failingMetric of ANALYTICS_INSIGHTS_SECTION_KEYS) {
      const context = {} as ReturnType<
        NonNullable<InsightsRouteDependencies['createTrendRequestContext']>
      >;
      const app = express();
      app.use(
        requestContext({ createRequestId: () => `req_${failingMetric}` }),
      );
      app.use((_request, response, next) => {
        response.locals.userId = '00000000-0000-0000-0000-000000000001';
        next();
      });
      app.use(
        '/api/v1/analytics/insights',
        createInsightsRouter({
          currentTrackingMode: async () => 'simple',
          createTrendRequestContext: () => context,
          computeCanonicalTrend: async (_userId, query) => {
            if (query.primaryMetric === failingMetric) {
              throw new Error(`${failingMetric} calculator failed`);
            }
            return trend(query.primaryMetric);
          },
          computeOverview: async () => failedOverview(),
        }),
      );
      app.use(errorHandler);

      const response = await request(app)
        .get('/api/v1/analytics/insights?period=week&contractVersion=2')
        .expect(200);

      expect(response.body.data.sections[failingMetric]).toEqual({
        status: 'failed',
        code: 'section_unavailable',
        retryable: true,
      });
      const healthyMetric =
        failingMetric === 'calories' ? 'protein' : 'calories';
      expect(response.body.data.sections[healthyMetric]).toMatchObject({
        status: 'available',
        data: { primaryMetric: healthyMetric },
      });
    }
  });

  it('keeps the flat core report when overview context computation fails', async () => {
    const context = {} as ReturnType<
      NonNullable<InsightsRouteDependencies['createTrendRequestContext']>
    >;
    const app = express();
    app.use(requestContext({ createRequestId: () => 'req_overview_failure' }));
    app.use((_request, response, next) => {
      response.locals.userId = '00000000-0000-0000-0000-000000000001';
      next();
    });
    app.use(
      '/api/v1/analytics/insights',
      createInsightsRouter({
        currentTrackingMode: async () => 'simple',
        createTrendRequestContext: () => context,
        computeCanonicalTrend: async (_userId, query) =>
          trend(query.primaryMetric),
        computeOverview: async () => {
          throw new Error('overview source query failed');
        },
      }),
    );
    app.use(errorHandler);

    const response = await request(app)
      .get('/api/v1/analytics/insights?period=week')
      .expect(200);

    expect(Object.keys(response.body.data.sections)).toEqual([
      ...ANALYTICS_INSIGHTS_SECTION_KEYS,
    ]);
    for (const key of ANALYTICS_OVERVIEW_KEYS) {
      expect(response.body.data.overview[key]).toEqual({
        status: 'failed',
        code: 'section_unavailable',
        retryable: true,
      });
    }
  });

  it('keeps a global context failure report-level', async () => {
    const app = express();
    app.use(
      requestContext({ createRequestId: () => 'req_global_context_failure' }),
    );
    app.use((_request, response, next) => {
      response.locals.userId = '00000000-0000-0000-0000-000000000001';
      next();
    });
    app.use(
      '/api/v1/analytics/insights',
      createInsightsRouter({
        currentTrackingMode: async () => 'simple',
        createTrendRequestContext: () => {
          throw new Error('database context unavailable');
        },
      }),
    );
    app.use(errorHandler);

    const response = await request(app)
      .get('/api/v1/analytics/insights?period=week')
      .expect(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The request could not be completed.',
        details: {},
      },
    });
  });
});
