import express from 'express';
import request from 'supertest';
import {
  type AnalyticsMetricKey,
  type CanonicalTrendResponse,
  type TrendQueryInput,
} from '@food-tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestContext } from '../src/middleware/request-context.js';
import {
  createInsightsRouter,
  type InsightsRouteDependencies,
} from '../src/modules/analytics/trends/routes.js';
import type { InsightsDiagnosticDetails } from '../src/modules/analytics/trends/insights-diagnostics.js';

const metricKeys = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
  'weight',
  'hydration',
  'loggingConsistency',
] as const satisfies readonly AnalyticsMetricKey[];

type DiagnosticEvent = {
  category: string;
  details: InsightsDiagnosticDetails;
};

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

function testApp(
  events: DiagnosticEvent[],
  overrides: Partial<InsightsRouteDependencies> = {},
) {
  const context = {} as ReturnType<
    NonNullable<InsightsRouteDependencies['createTrendRequestContext']>
  >;
  const computeCanonicalTrend: NonNullable<
    InsightsRouteDependencies['computeCanonicalTrend']
  > = async (_userId, query: TrendQueryInput) => trend(query.primaryMetric);
  const app = express();
  app.use(
    requestContext({
      createRequestId: () => 'req_insights_diagnostics_test',
    }),
  );
  app.use((_request, response, next) => {
    response.locals.userId = 'user_secret_should_not_be_logged';
    next();
  });
  app.use(
    '/api/v1/analytics/insights',
    createInsightsRouter({
      currentTrackingMode: async () => 'complex',
      createTrendRequestContext: () => context,
      computeCanonicalTrend,
      emitDiagnostic: (category, details) => events.push({ category, details }),
      ...overrides,
    }),
  );
  app.use(errorHandler);
  return app;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('staging Insights route diagnostics', () => {
  it('logs the high-level WEEK boundaries and per-metric start/success pairs', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    const events: DiagnosticEvent[] = [];

    const response = await request(testApp(events)).get(
      '/api/v1/analytics/insights?period=week',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.period).toBe('week');
    expect(Object.keys(response.body.data.sections)).toEqual(metricKeys);
    expect(events.map((event) => event.category)).toEqual([
      'insights_route_started',
      'insights_tracking_mode_started',
      'insights_tracking_mode_succeeded',
      'insights_context_started',
      'insights_context_succeeded',
      'insights_metric_started',
      'insights_metric_started',
      'insights_metric_started',
      'insights_metric_started',
      'insights_metric_started',
      'insights_metric_started',
      'insights_metric_started',
      'insights_metric_started',
      'insights_metric_succeeded',
      'insights_metric_succeeded',
      'insights_metric_succeeded',
      'insights_metric_succeeded',
      'insights_metric_succeeded',
      'insights_metric_succeeded',
      'insights_metric_succeeded',
      'insights_metric_succeeded',
      'insights_computation_succeeded',
      'insights_response_send_started',
      'insights_response_send_succeeded',
    ]);
    for (const metric of metricKeys) {
      expect(
        events.filter(
          (event) =>
            event.details.metric === metric &&
            event.category === 'insights_metric_started',
        ),
      ).toHaveLength(1);
      expect(
        events.filter(
          (event) =>
            event.details.metric === metric &&
            event.category === 'insights_metric_succeeded',
        ),
      ).toHaveLength(1);
    }
    expect(
      events.every(
        (event) => event.details.requestId === 'req_insights_diagnostics_test',
      ),
    ).toBe(true);
  });

  it('identifies a failing metric while preserving the generic 500 envelope', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    const events: DiagnosticEvent[] = [];
    const computeCanonicalTrend: NonNullable<
      InsightsRouteDependencies['computeCanonicalTrend']
    > = async (_userId, query: TrendQueryInput) => {
      if (query.primaryMetric === 'hydration') {
        const error = new Error(
          'Prisma query failed foodName="Secret Burger" email=person@example.com Authorization: Bearer secret-token userId=user_secret',
        );
        Object.assign(error, { code: 'P2021' });
        error.stack =
          'Error: private details\n    at /app/apps/api/dist/modules/analytics/trends/ranges.js:72:11\n    at /app/node_modules/prisma/client.js:1:1';
        throw error;
      }
      return trend(query.primaryMetric);
    };

    const response = await request(
      testApp(events, { computeCanonicalTrend }),
    ).get('/api/v1/analytics/insights?period=week');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The request could not be completed.',
        details: {},
      },
    });
    const failure = events.find(
      (event) => event.category === 'insights_metric_failed',
    );
    expect(failure).toMatchObject({
      details: {
        requestId: 'req_insights_diagnostics_test',
        period: 'week',
        trackingMode: 'complex',
        metric: 'hydration',
        errorName: 'Error',
        errorCode: 'P2021',
        errorLocation: 'apps/api/src/modules/analytics/trends/ranges.ts:72',
      },
    });
    expect(JSON.stringify(failure)).not.toMatch(
      /user_secret|person@example\.com|Secret Burger|secret-token|Authorization/i,
    );
  });

  it('suppresses route diagnostics outside staging', async () => {
    vi.stubEnv('APP_ENV', 'production');
    const events: DiagnosticEvent[] = [];

    const response = await request(testApp(events)).get(
      '/api/v1/analytics/insights?period=week',
    );

    expect(response.status).toBe(200);
    expect(events).toEqual([]);
  });
});
