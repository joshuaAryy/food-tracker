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
const expectedSectionKeys = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
  'weight',
  'hydration',
  'loggingConsistency',
] as const;

function trend(
  primaryMetric: AnalyticsMetricKey,
  trackingMode: 'simple' | 'complex' = 'simple',
): CanonicalTrendResponse {
  return {
    timezone: 'America/New_York',
    trackingMode,
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
  it('materializes all eight section states after an initial partial network commit', () => {
    const state = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({ calories: available('calories', 1900) }),
        updatedAt: 2,
      },
    );

    expect(Object.keys(state.sections)).toEqual(expectedSectionKeys);
    expect(state).toMatchObject({
      status: 'ready',
      requestKind: 'initial_load',
      requestPhase: 'network_committed',
      sections: {
        calories: { status: 'available', data: { summary: { average: 1900 } } },
        protein: { status: 'unavailable', data: null, retryable: true },
        carbs: { status: 'unavailable', data: null, retryable: true },
        fat: { status: 'unavailable', data: null, retryable: true },
        macroComposition: {
          status: 'unavailable',
          data: null,
          retryable: true,
        },
        weight: { status: 'unavailable', data: null, retryable: true },
        hydration: { status: 'unavailable', data: null, retryable: true },
        loggingConsistency: {
          status: 'unavailable',
          data: null,
          retryable: true,
        },
      },
    });
  });

  it('materializes all eight section states after an initial partial stale hydration', () => {
    const state = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'hydrate',
        requestId: 1,
        report: report({ calories: available('calories', 1700) }),
        updatedAt: 1,
        stale: true,
      },
    );

    expect(Object.keys(state.sections)).toEqual(expectedSectionKeys);
    expect(state).toMatchObject({
      status: 'stale',
      staleSource: 'offline_cache',
      requestKind: 'initial_load',
      requestPhase: 'cache_hydrated',
      sections: {
        calories: { status: 'stale', data: { summary: { average: 1700 } } },
        protein: { status: 'unavailable', data: null, retryable: true },
        hydration: { status: 'unavailable', data: null, retryable: true },
        loggingConsistency: {
          status: 'unavailable',
          data: null,
          retryable: true,
        },
      },
    });
  });

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

  it('settles an omitted refresh result as stale when prior data exists', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({
          calories: available('calories', 1846),
          hydration: available('hydration', 1630),
        }),
        updatedAt: 1,
      },
    );
    const refreshing = analyticsReportResourceReducer(ready, {
      type: 'refresh',
      requestId: 2,
    });
    const settled = analyticsReportResourceReducer(refreshing, {
      type: 'commit',
      requestId: 2,
      report: report({ calories: available('calories', 1900) }),
      updatedAt: 2,
    });

    expect(settled).toMatchObject({
      status: 'ready',
      sections: {
        calories: { status: 'available', data: { summary: { average: 1900 } } },
        hydration: {
          status: 'stale',
          data: { summary: { average: 1630 } },
          retryable: true,
        },
      },
    });
    expect(Object.values(settled.sections)).not.toContainEqual(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('settles every pending section as refresh-failed stale after a whole-request failure', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({
          calories: available('calories'),
          hydration: available('hydration'),
        }),
        updatedAt: 1,
      },
    );
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(ready, {
        type: 'refresh',
        requestId: 2,
      }),
      { type: 'failure', requestId: 2 },
    );

    expect(failed).toMatchObject({
      status: 'stale',
      staleSource: 'refresh_failed',
      error: "Couldn't refresh analytics. Showing earlier data.",
      sections: {
        calories: { status: 'stale', retryable: true },
        hydration: { status: 'stale', retryable: true },
      },
    });
    expect(Object.values(failed.sections)).not.toContainEqual(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('settles a malformed mixed response through the report-level failure action', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({ calories: available('calories') }),
        updatedAt: 1,
      },
    );
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(ready, {
        type: 'refresh',
        requestId: 2,
      }),
      { type: 'failure', requestId: 2 },
    );

    expect(failed.sections.calories).toMatchObject({
      status: 'stale',
      retryable: true,
    });
    expect(failed.sections.calories?.status).not.toBe('pending');
  });

  it('keeps healthy siblings available while only the retrying section becomes pending', () => {
    const ready = analyticsReportResourceReducer(
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
    const retrying = analyticsReportResourceReducer(ready, {
      type: 'sectionRetry',
      requestId: 2,
      section: 'hydration',
    });

    expect(retrying).toMatchObject({
      status: 'refreshing',
      retry: { kind: 'canonical_insights_request', section: 'hydration' },
      sections: {
        calories: { status: 'available', data: expect.any(Object) },
        hydration: { status: 'pending', data: null, error: null },
      },
    });
  });

  it('settles only a no-data retry target when its canonical request fails', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({ calories: available('calories', 1846) }),
        updatedAt: 2,
      },
    );
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(ready, {
        type: 'sectionRetry',
        requestId: 2,
        section: 'hydration',
      }),
      { type: 'failure', requestId: 2 },
    );

    expect(failed).toMatchObject({
      status: 'ready',
      staleSource: null,
      error: null,
      requestKind: 'section_retry',
      requestPhase: 'network_failed',
      sections: {
        calories: {
          status: 'available',
          data: { summary: { average: 1846 } },
          error: null,
          retryable: false,
        },
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

  it('settles only a retry target with prior data as stale after failure', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({
          calories: available('calories', 1846),
          hydration: available('hydration', 1630),
        }),
        updatedAt: 2,
      },
    );
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(ready, {
        type: 'sectionRetry',
        requestId: 2,
        section: 'hydration',
      }),
      { type: 'failure', requestId: 2 },
    );

    expect(failed.sections.calories).toMatchObject({
      status: 'available',
      data: { summary: { average: 1846 } },
      error: null,
      retryable: false,
    });
    expect(failed.sections.hydration).toMatchObject({
      status: 'stale',
      data: { summary: { average: 1630 } },
      retryable: true,
    });
  });

  it('ignores a duplicate terminal failure after a section retry failure', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({
          calories: available('calories', 1846),
          hydration: available('hydration', 1630),
        }),
        updatedAt: 2,
      },
    );
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(ready, {
        type: 'sectionRetry',
        requestId: 2,
        section: 'hydration',
      }),
      { type: 'failure', requestId: 2 },
    );
    const duplicate = analyticsReportResourceReducer(failed, {
      type: 'failure',
      requestId: 2,
    });

    expect(duplicate).toBe(failed);
    expect(duplicate.sections.calories).toMatchObject({
      status: 'available',
      data: { summary: { average: 1846 } },
      error: null,
      retryable: false,
    });
    expect(duplicate.sections.hydration).toMatchObject({
      status: 'stale',
      data: { summary: { average: 1630 } },
      retryable: true,
    });
  });

  it('marks a no-data retry target pending and settles it unavailable on failure', () => {
    const retrying = analyticsReportResourceReducer(
      initialAnalyticsReportResource(),
      { type: 'sectionRetry', requestId: 1, section: 'hydration' },
    );
    const failed = analyticsReportResourceReducer(retrying, {
      type: 'failure',
      requestId: 1,
    });

    expect(retrying).toMatchObject({
      status: 'loading',
      sections: { hydration: { status: 'pending', data: null } },
    });
    expect(failed).toMatchObject({
      status: 'error',
      staleSource: null,
      sections: {
        hydration: { status: 'unavailable', data: null, retryable: true },
      },
    });
  });

  it('settles an omitted no-data target unavailable on a terminal commit', () => {
    const retrying = analyticsReportResourceReducer(
      initialAnalyticsReportResource(),
      { type: 'sectionRetry', requestId: 1, section: 'hydration' },
    );
    const settled = analyticsReportResourceReducer(retrying, {
      type: 'commit',
      requestId: 1,
      report: report({ calories: available('calories') }),
      updatedAt: 1,
    });

    expect(settled).toMatchObject({
      status: 'ready',
      sections: {
        calories: { status: 'available' },
        hydration: { status: 'unavailable', data: null, retryable: true },
      },
    });
    expect(settled.sections.hydration?.status).not.toBe('pending');
  });

  it('ignores an older generation completion after a newer retry begins', () => {
    const retrying = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      { type: 'sectionRetry', requestId: 2, section: 'calories' },
    );
    const staleCompletion = analyticsReportResourceReducer(retrying, {
      type: 'commit',
      requestId: 1,
      report: report({ calories: available('calories', 999) }),
      updatedAt: 1,
    });

    expect(staleCompletion).toEqual(retrying);
  });

  it('ignores same-generation cache hydration after a network commit', () => {
    const loading = analyticsReportResourceReducer(
      initialAnalyticsReportResource(),
      { type: 'load', requestId: 1 },
    );
    const committed = analyticsReportResourceReducer(loading, {
      type: 'commit',
      requestId: 1,
      report: report({ calories: available('calories', 1900) }),
      updatedAt: 2,
    });
    const lateHydration = analyticsReportResourceReducer(committed, {
      type: 'hydrate',
      requestId: 1,
      report: report({ calories: available('calories', 1700) }),
      updatedAt: 1,
      stale: true,
    });

    expect(lateHydration).toEqual(committed);
  });

  it('ignores older hydration while a canonical refresh is pending', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({ calories: available('calories', 1900) }),
        updatedAt: 2,
      },
    );
    const refreshing = analyticsReportResourceReducer(ready, {
      type: 'refresh',
      requestId: 2,
    });
    const hydration = analyticsReportResourceReducer(refreshing, {
      type: 'hydrate',
      requestId: 2,
      report: report({ calories: available('calories', 1700) }),
      updatedAt: 1,
      stale: true,
    });

    expect(hydration).toEqual(refreshing);
    expect(hydration).toMatchObject({
      status: 'refreshing',
      requestKind: 'canonical_refresh',
      requestPhase: 'pending',
      updatedAt: 2,
      sections: { calories: { data: { summary: { average: 1900 } } } },
    });
  });

  it('ignores older hydration after a canonical refresh failure', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({ calories: available('calories', 1900) }),
        updatedAt: 2,
      },
    );
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(ready, {
        type: 'refresh',
        requestId: 2,
      }),
      { type: 'failure', requestId: 2 },
    );
    const hydration = analyticsReportResourceReducer(failed, {
      type: 'hydrate',
      requestId: 2,
      report: report({ calories: available('calories', 1700) }),
      updatedAt: 1,
      stale: true,
    });

    expect(hydration).toEqual(failed);
    expect(hydration).toMatchObject({
      status: 'stale',
      staleSource: 'refresh_failed',
      requestKind: 'canonical_refresh',
      requestPhase: 'network_failed',
      updatedAt: 2,
      sections: { calories: { data: { summary: { average: 1900 } } } },
    });
  });

  it('ignores a duplicate terminal failure after a canonical refresh failure', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({ calories: available('calories', 1900) }),
        updatedAt: 2,
      },
    );
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(ready, {
        type: 'refresh',
        requestId: 2,
      }),
      { type: 'failure', requestId: 2 },
    );
    const duplicate = analyticsReportResourceReducer(failed, {
      type: 'failure',
      requestId: 2,
    });

    expect(duplicate).toBe(failed);
  });

  it('ignores cache hydration during and after a section retry failure', () => {
    const ready = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      {
        type: 'commit',
        requestId: 1,
        report: report({
          calories: available('calories', 1900),
          hydration: available('hydration', 1630),
        }),
        updatedAt: 2,
      },
    );
    const retrying = analyticsReportResourceReducer(ready, {
      type: 'sectionRetry',
      requestId: 2,
      section: 'hydration',
    });
    const hydrateAction = {
      type: 'hydrate' as const,
      requestId: 2,
      report: report({ calories: available('calories', 1700) }),
      updatedAt: 1,
      stale: true,
    };

    expect(analyticsReportResourceReducer(retrying, hydrateAction)).toEqual(
      retrying,
    );

    const failed = analyticsReportResourceReducer(retrying, {
      type: 'failure',
      requestId: 2,
    });
    expect(analyticsReportResourceReducer(failed, hydrateAction)).toEqual(
      failed,
    );
  });

  it('accepts cache hydration after an initial network failure with no committed report', () => {
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(initialAnalyticsReportResource(), {
        type: 'load',
        requestId: 1,
      }),
      { type: 'failure', requestId: 1 },
    );
    const duplicateFailure = analyticsReportResourceReducer(failed, {
      type: 'failure',
      requestId: 1,
    });
    const hydrated = analyticsReportResourceReducer(duplicateFailure, {
      type: 'hydrate',
      requestId: 1,
      report: report({ calories: available('calories', 1700) }),
      updatedAt: 1,
      stale: true,
    });

    expect(hydrated).toMatchObject({
      status: 'stale',
      staleSource: 'offline_cache',
      requestKind: 'initial_load',
      requestPhase: 'cache_hydrated',
      updatedAt: 1,
      sections: { calories: { data: { summary: { average: 1700 } } } },
    });
  });

  it('keeps the newest cache hydration during initial load', () => {
    const loading = analyticsReportResourceReducer(
      initialAnalyticsReportResource(),
      { type: 'load', requestId: 1 },
    );
    const newest = analyticsReportResourceReducer(loading, {
      type: 'hydrate',
      requestId: 1,
      report: report({ calories: available('calories', 1900) }),
      updatedAt: 2,
      stale: true,
    });
    const older = analyticsReportResourceReducer(newest, {
      type: 'hydrate',
      requestId: 1,
      report: report({ calories: available('calories', 1700) }),
      updatedAt: 1,
      stale: true,
    });

    expect(older).toEqual(newest);
    expect(older).toMatchObject({
      requestKind: 'initial_load',
      requestPhase: 'cache_hydrated',
      updatedAt: 2,
      sections: { calories: { data: { summary: { average: 1900 } } } },
    });
  });

  it('accepts a newer cache hydration during initial load', () => {
    const loading = analyticsReportResourceReducer(
      initialAnalyticsReportResource(),
      { type: 'load', requestId: 1 },
    );
    const older = analyticsReportResourceReducer(loading, {
      type: 'hydrate',
      requestId: 1,
      report: report({ calories: available('calories', 1700) }),
      updatedAt: 1,
      stale: true,
    });
    const newer = analyticsReportResourceReducer(older, {
      type: 'hydrate',
      requestId: 1,
      report: report({ calories: available('calories', 1900) }),
      updatedAt: 2,
      stale: true,
    });

    expect(newer).toMatchObject({
      requestKind: 'initial_load',
      requestPhase: 'cache_hydrated',
      updatedAt: 2,
      sections: { calories: { data: { summary: { average: 1900 } } } },
    });
  });

  it('distinguishes offline cache from a later refresh failure with safe copy', () => {
    const loading = analyticsReportResourceReducer(
      initialAnalyticsReportResource(),
      { type: 'load', requestId: 1 },
    );
    const offline = analyticsReportResourceReducer(loading, {
      type: 'hydrate',
      requestId: 1,
      report: report({ calories: available('calories') }),
      updatedAt: 1,
      stale: true,
    });
    const failed = analyticsReportResourceReducer(
      analyticsReportResourceReducer(offline, {
        type: 'refresh',
        requestId: 2,
      }),
      { type: 'failure', requestId: 2 },
    );

    expect(offline).toMatchObject({
      status: 'stale',
      staleSource: 'offline_cache',
      error: 'Offline. Showing saved analytics.',
    });
    expect(failed).toMatchObject({
      status: 'stale',
      staleSource: 'refresh_failed',
      error: "Couldn't refresh analytics. Showing earlier data.",
    });
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

  it('rejects empty, key-mismatched, and mode-mismatched v1 reports', () => {
    expect(
      adaptCanonicalInsightsResponseV1(
        { mode: 'simple', period: 'week', sections: {} },
        fetchedAt,
      ),
    ).toBeNull();
    expect(
      adaptCanonicalInsightsResponseV1(
        {
          mode: 'simple',
          period: 'week',
          sections: { calories: trend('hydration') },
        },
        fetchedAt,
      ),
    ).toBeNull();
    expect(
      adaptCanonicalInsightsResponseV1(
        {
          mode: 'simple',
          period: 'week',
          sections: { calories: trend('calories', 'complex') },
        },
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
