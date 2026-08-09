import { describe, expect, it } from 'vitest';
import {
  resolveTrendQuery,
  simpleTrendMetrics,
  trendRouteForMetric,
} from './trend-routing';

describe('trend routing', () => {
  it('keeps Simple exploration limited to the approved curated metrics', () => {
    expect(simpleTrendMetrics).toEqual([
      'calories',
      'protein',
      'carbs',
      'fat',
      'macroComposition',
      'weight',
      'hydration',
      'loggingConsistency',
    ]);
  });

  it('uses a stable metric route without exposing complex configuration', () => {
    expect(trendRouteForMetric('calories')).toBe('/trends/calories');
    expect(trendRouteForMetric('vitaminC')).toBe('/trends/vitaminC');
  });

  it('preserves an applied Custom Range instead of replacing it with a period chip', () => {
    expect(
      resolveTrendQuery({
        metric: 'protein',
        restoredQuery: {
          primaryMetric: 'protein',
          period: {
            kind: 'custom',
            startDate: '2026-06-01',
            endDate: '2026-08-01',
          },
          aggregation: 'weekly',
          visualization: 'smoothed_line',
          showReference: true,
          coverageFilter: 'complete_only',
        },
        selectedRelativePeriod: null,
      }),
    ).toMatchObject({
      period: {
        kind: 'custom',
        startDate: '2026-06-01',
        endDate: '2026-08-01',
      },
      aggregation: 'weekly',
      coverageFilter: 'complete_only',
    });
  });
});
