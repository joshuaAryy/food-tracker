import { describe, expect, it } from 'vitest';
import {
  caloriesTrendRoute,
  insightsRoute,
  loggingConsistencyTrendRoute,
  trendRouteForProgressMetric,
  weightTrendRoute,
} from './progress-trend-routing';

describe('Progress Trend routing', () => {
  it('maps the approved Progress entrypoints to canonical Trends', () => {
    expect(caloriesTrendRoute()).toBe('/trends/calories');
    expect(weightTrendRoute()).toBe('/trends/weight');
    expect(loggingConsistencyTrendRoute()).toBe('/trends/loggingConsistency');
    expect(trendRouteForProgressMetric('vitaminC')).toBe('/trends/vitaminC');
    expect(insightsRoute()).toBe('/(tabs)/insights');
  });
});
