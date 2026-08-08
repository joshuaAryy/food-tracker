import { describe, expect, it } from 'vitest';
import { simpleTrendMetrics, trendRouteForMetric } from './trend-routing';

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
});
