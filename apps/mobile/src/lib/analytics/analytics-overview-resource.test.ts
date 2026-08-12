import { ANALYTICS_OVERVIEW_KEYS } from '@food-tracker/shared';
import type {
  AnalyticsOverviewKey,
  AnalyticsOverviewResultMap,
  CanonicalInsightsResponseV2,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  analyticsReportResourceReducer,
  initialAnalyticsReportResource,
} from './analytics-report-resource';
import {
  adaptCanonicalInsightsResponseV1,
  adaptCanonicalInsightsResponseWithOverview,
} from './analytics-v1-adapter';

const fetchedAt = '2026-08-11T12:00:00.000Z';

function availablePeriodSummary(loggedDayCount: number) {
  return {
    status: 'available' as const,
    fetchedAt,
    data: {
      resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
      todaySoFar: {
        date: '2026-08-07',
        mealCount: loggedDayCount,
        calories: { value: null, state: 'unknown' as const },
        protein: { value: null, state: 'unknown' as const },
      },
      loggedDayCount,
      eligibleLoggedDayCount: loggedDayCount,
      eligibleTotalDayCount: 7,
      streak: { currentDays: 1, longestDays: 2 },
      currentDayPhase: 'in_progress' as const,
      consistency: 29,
      interpretation: 'building' as const,
    },
  };
}

function failedOverview() {
  return {
    status: 'failed' as const,
    code: 'section_unavailable' as const,
    retryable: true as const,
  };
}

function report(
  overview: Partial<NonNullable<CanonicalInsightsResponseV2['overview']>>,
): CanonicalInsightsResponseV2 {
  const completeOverview = Object.fromEntries(
    ANALYTICS_OVERVIEW_KEYS.map((key) => [key, failedOverview()]),
  ) as AnalyticsOverviewResultMap;
  return {
    contractVersion: 2,
    mode: 'simple',
    period: 'week',
    sections: {
      calories: {
        status: 'available',
        fetchedAt,
        data: {
          timezone: 'America/New_York',
          trackingMode: 'simple',
          primaryMetric: 'calories',
          aggregation: 'daily',
          resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
          firstEligibleDate: null,
          today: '2026-08-07',
          reference: { kind: 'none', unit: 'kcal', reason: 'not_configured' },
          interpretation: null,
          relatedMetrics: [],
          points: [],
          summary: { numericDayCount: 2, average: 1846 },
        },
      },
    },
    overview: { ...completeOverview, ...overview },
  };
}

describe('analytics overview resource state', () => {
  it('retains committed overview siblings when a hydration overview result fails', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({
          periodSummary: availablePeriodSummary(2),
          hydration: {
            status: 'available',
            fetchedAt,
            data: {
              today: '2026-08-07',
              timezone: 'America/New_York',
              total: 1630,
              goal: 2000,
              status: 'below_goal',
              trendSection: 'hydration',
            },
          },
        }),
        updatedAt: 1,
      },
    );
    const refreshed = analyticsReportResourceReducer(ready, {
      type: 'refresh',
      requestId: 2,
    });
    const settled = analyticsReportResourceReducer(refreshed, {
      type: 'commit',
      requestId: 2,
      report: report({
        periodSummary: availablePeriodSummary(3),
        hydration: failedOverview(),
      }),
      updatedAt: 2,
    });

    expect(settled.overview).toMatchObject({
      periodSummary: {
        status: 'available',
        data: { loggedDayCount: 3 },
      },
      hydration: {
        status: 'stale',
        data: { total: 1630 },
        retryable: true,
      },
    });
    expect(settled.sections.calories).toMatchObject({ status: 'available' });
  });

  it('settles only a retried overview group unavailable and leaves the report and core trend healthy', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({ periodSummary: availablePeriodSummary(2) }),
        updatedAt: 1,
      },
    );
    const retrying = analyticsReportResourceReducer(ready, {
      type: 'overviewRetry',
      requestId: 2,
      overview: 'hydration' satisfies AnalyticsOverviewKey,
    });
    const failed = analyticsReportResourceReducer(retrying, {
      type: 'failure',
      requestId: 2,
    });
    const duplicate = analyticsReportResourceReducer(failed, {
      type: 'failure',
      requestId: 2,
    });

    expect(failed).toMatchObject({
      status: 'ready',
      error: null,
      overview: {
        periodSummary: { status: 'available', data: { loggedDayCount: 2 } },
        hydration: { status: 'unavailable', data: null, retryable: true },
      },
      sections: { calories: { status: 'available' } },
    });
    expect(duplicate).toBe(failed);
  });

  it('keeps the v1 adapter overview explicitly unavailable instead of deriving facts', () => {
    const v1Calories = report({}).sections.calories;
    if (v1Calories?.status !== 'available') {
      throw new Error('Expected a valid Calories fixture.');
    }
    const adapted = adaptCanonicalInsightsResponseV1(
      {
        mode: 'simple',
        period: 'week',
        sections: {
          calories: v1Calories.data,
        },
      },
      fetchedAt,
    );

    expect(adapted?.overview).toEqual({
      periodSummary: failedOverview(),
      energy: failedOverview(),
      macros: failedOverview(),
      nutrientHighlights: failedOverview(),
      hydration: failedOverview(),
      weight: failedOverview(),
      loggingConsistency: failedOverview(),
    });
  });

  it('normalizes the flat live bridge without deriving overview facts on mobile', () => {
    const source = report({ periodSummary: availablePeriodSummary(2) });
    const calories = source.sections.calories;
    if (calories?.status !== 'available') {
      throw new Error('Expected a valid Calories fixture.');
    }

    const adapted = adaptCanonicalInsightsResponseWithOverview(
      {
        mode: source.mode,
        period: source.period,
        sections: { calories: calories.data },
        overview: source.overview,
      },
      fetchedAt,
    );
    expect(adapted).toMatchObject({
      contractVersion: 2,
      sections: {
        calories: { status: 'available', data: calories.data, fetchedAt },
      },
      overview: {
        periodSummary: {
          status: 'available',
          data: { loggedDayCount: 2 },
        },
      },
    });
  });
});
