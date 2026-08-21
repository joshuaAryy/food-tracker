import { describe, expect, it } from 'vitest';
import {
  autoSavedViewName,
  savedViewInputFromTrend,
  trendQueryFromRouteParam,
  trendQueryFromSavedView,
  trendQueryRouteParam,
  pinnedInsightsTrendQuery,
} from './saved-view-configuration';

describe('saved-view configuration', () => {
  it('converts a temporary custom Trend range into a rolling inclusive saved period', () => {
    const input = savedViewInputFromTrend({
      primaryMetric: 'protein',
      comparisonMetric: 'weight',
      period: {
        kind: 'custom',
        startDate: '2026-07-10',
        endDate: '2026-08-07',
      },
      aggregation: 'weekly',
      visualization: 'dual_axis',
      showReference: true,
      coverageFilter: 'complete_only',
    });

    expect(input).toEqual({
      name: 'Protein + Weight · 29D',
      primaryMetric: 'protein',
      comparisonMetric: 'weight',
      periodDays: 29,
      aggregation: 'weekly',
      visualization: 'dual_axis',
      showReference: true,
      coverageFilter: 'complete_only',
    });
  });

  it('names a single-metric rolling view without inventing a comparison', () => {
    expect(
      autoSavedViewName({ primaryMetric: 'hydration', periodDays: 90 }),
    ).toBe('Hydration · 90D');
  });

  it('restores a renderable saved view as its original rolling Trend query', () => {
    expect(
      trendQueryFromSavedView({
        id: 'saved-view-1',
        name: 'Protein + Weight · 90D',
        primaryMetric: 'protein',
        comparisonMetric: 'weight',
        periodDays: 90,
        aggregation: 'weekly',
        visualization: 'dual_axis',
        showReference: false,
        coverageFilter: 'complete_and_partial',
        sortOrder: 0,
        createdAt: '2026-08-08T00:00:00.000Z',
        updatedAt: '2026-08-08T00:00:00.000Z',
        unavailableMetrics: [],
      }),
    ).toEqual({
      primaryMetric: 'protein',
      comparisonMetric: 'weight',
      period: { kind: 'relative', days: 90 },
      aggregation: 'weekly',
      visualization: 'dual_axis',
      showReference: false,
      coverageFilter: 'complete_and_partial',
    });
  });

  it('does not try to restore a saved view with an unavailable metric', () => {
    expect(
      trendQueryFromSavedView({
        id: 'saved-view-2',
        name: 'Retired',
        primaryMetric: 'retiredNutrient',
        comparisonMetric: null,
        periodDays: 30,
        aggregation: 'automatic',
        visualization: 'automatic',
        showReference: true,
        coverageFilter: 'all_logged_days',
        sortOrder: 0,
        createdAt: '2026-08-08T00:00:00.000Z',
        updatedAt: '2026-08-08T00:00:00.000Z',
        unavailableMetrics: ['retiredNutrient'],
      }),
    ).toBeNull();
  });

  it('round-trips a saved Trend query through route parameters', () => {
    const query = {
      primaryMetric: 'protein' as const,
      comparisonMetric: 'weight' as const,
      period: { kind: 'relative' as const, days: 90 },
      aggregation: 'weekly' as const,
      visualization: 'dual_axis' as const,
      showReference: true,
      coverageFilter: 'all_logged_days' as const,
    };

    expect(trendQueryFromRouteParam(trendQueryRouteParam(query))).toEqual(
      query,
    );
  });

  it('uses the normal Calories fallback when no renderable view is pinned', () => {
    expect(pinnedInsightsTrendQuery(null, [])).toMatchObject({
      primaryMetric: 'calories',
      period: { kind: 'relative', days: 30 },
    });
  });
});
