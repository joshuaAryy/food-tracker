import type {
  AnalyticsMetricKey,
  AnalyticsSectionKey,
  CanonicalInsightsResponseV2,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./analytics-cache-native', () => ({
  getNativeAnalyticsCache: vi.fn(),
}));

import { ANALYTICS_CACHE_KEYS } from './analytics-cache-runtime';
import {
  analyticsReportResourceReducer,
  initialAnalyticsReportResource,
  safeAnalyticsSectionError,
} from './analytics-report-resource';
import { adaptCanonicalInsightsResponseV1 } from './analytics-v1-adapter';

const fetchedAt = '2026-08-11T12:00:00.000Z';

function trend(primaryMetric: AnalyticsMetricKey): CanonicalTrendResponse {
  return {
    timezone: 'America/New_York',
    trackingMode: 'simple',
    primaryMetric,
    aggregation: 'daily',
    resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
    firstEligibleDate: null,
    today: '2026-08-07',
    reference: { kind: 'none', unit: 'kcal', reason: 'not_configured' },
    interpretation: null,
    relatedMetrics: [],
    points: [],
    summary: { numericDayCount: 0, average: 1846 },
  };
}

const v1Report = {
  mode: 'simple',
  period: 'month',
  sections: {
    calories: trend('calories'),
    hydration: trend('hydration'),
  },
} as const;

function available(
  section: AnalyticsSectionKey,
  average: number | null = 1846,
) {
  const data = trend(section);
  return {
    status: 'available' as const,
    fetchedAt,
    data: {
      ...data,
      summary: { ...data.summary, average },
    },
  };
}

function report(
  sections: CanonicalInsightsResponseV2['sections'],
): CanonicalInsightsResponseV2 {
  return {
    contractVersion: 2,
    mode: 'simple',
    period: 'month',
    sections,
  };
}

describe('analytics report resource state', () => {
  it('keeps committed siblings while a canonical refresh is pending and merges a local failure as stale', () => {
    const committed = analyticsReportResourceReducer(
      initialAnalyticsReportResource(),
      { type: 'load', requestId: 1 },
    );
    const ready = analyticsReportResourceReducer(committed, {
      type: 'commit',
      requestId: 1,
      report: report({
        calories: available('calories', 1846),
        hydration: available('hydration', 1630),
      }),
      updatedAt: 1,
    });
    const refreshing = analyticsReportResourceReducer(ready, {
      type: 'refresh',
      requestId: 2,
    });

    expect(refreshing).toMatchObject({
      status: 'refreshing',
      sections: {
        calories: { status: 'pending', data: { summary: { average: 1846 } } },
        hydration: { status: 'pending', data: { summary: { average: 1630 } } },
      },
    });

    const merged = analyticsReportResourceReducer(refreshing, {
      type: 'commit',
      requestId: 2,
      report: report({
        calories: available('calories', 1900),
        hydration: {
          status: 'failed',
          code: 'section_unavailable',
          retryable: true,
        },
      }),
      updatedAt: 2,
    });

    expect(merged).toMatchObject({
      status: 'ready',
      updatedAt: 2,
      sections: {
        calories: { status: 'available', data: { summary: { average: 1900 } } },
        hydration: {
          status: 'stale',
          data: { summary: { average: 1630 } },
          error:
            'This analytics section is temporarily unavailable. Please try again.',
          retryable: true,
        },
      },
    });
  });

  it('marks a failed section without committed data unavailable without converting it into report failure', () => {
    const state = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({
          calories: available('calories'),
          hydration: {
            status: 'failed',
            code: 'section_unavailable',
            retryable: true,
          },
        }),
        updatedAt: 1,
      },
    );

    expect(state).toMatchObject({
      status: 'ready',
      error: null,
      sections: {
        calories: { status: 'available' },
        hydration: {
          status: 'unavailable',
          data: null,
          error:
            'This analytics section is temporarily unavailable. Please try again.',
          retryable: true,
        },
      },
    });
  });

  it('rejects stale completions and keeps section retry as a canonical-request intent', () => {
    const ready = analyticsReportResourceReducer(
      initialAnalyticsReportResource(),
      {
        type: 'hydrate',
        requestId: 1,
        report: report({ calories: available('calories') }),
        updatedAt: 1,
        stale: true,
      },
    );
    const retrying = analyticsReportResourceReducer(ready, {
      type: 'sectionRetry',
      requestId: 2,
      section: 'calories',
    });
    const staleCompletion = analyticsReportResourceReducer(retrying, {
      type: 'commit',
      requestId: 1,
      report: report({ calories: available('calories', 999) }),
      updatedAt: 2,
    });

    expect(retrying).toMatchObject({
      status: 'refreshing',
      retry: { kind: 'canonical_insights_request', section: 'calories' },
      sections: { calories: { status: 'pending', data: expect.any(Object) } },
    });
    expect(staleCompletion).toEqual(retrying);
  });

  it('maps section errors to one user-safe message without internal details', () => {
    expect(
      safeAnalyticsSectionError({
        status: 'failed',
        code: 'section_unavailable',
        retryable: true,
      }),
    ).toBe(
      'This analytics section is temporarily unavailable. Please try again.',
    );
  });

  it('adapts only a valid v1 successful report into available v2 sections', () => {
    const adapted = adaptCanonicalInsightsResponseV1(v1Report, fetchedAt);

    expect(adapted).toMatchObject({
      contractVersion: 2,
      mode: 'simple',
      period: 'month',
      sections: {
        calories: { status: 'available', fetchedAt },
        hydration: { status: 'available', fetchedAt },
      },
    });
    expect(
      adaptCanonicalInsightsResponseV1(
        { ...v1Report, sections: { calories: { today: 'bad' } } },
        fetchedAt,
      ),
    ).toBeNull();
  });

  it('keeps v2 Insights cache keys distinct from the live v1 keys', () => {
    expect(ANALYTICS_CACHE_KEYS).toMatchObject({
      insightsWeek: 'insights-week',
      insightsMonth: 'insights-month',
      insightsV2Week: 'insights-v2-week',
      insightsV2Month: 'insights-v2-month',
    });
    expect(ANALYTICS_CACHE_KEYS.insightsV2Week).not.toBe(
      ANALYTICS_CACHE_KEYS.insightsWeek,
    );
    expect(ANALYTICS_CACHE_KEYS.insightsV2Month).not.toBe(
      ANALYTICS_CACHE_KEYS.insightsMonth,
    );
  });
});
