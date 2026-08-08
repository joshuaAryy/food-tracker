import { describe, expect, it } from 'vitest';
import {
  autoSavedViewName,
  savedViewInputFromTrend,
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
});
