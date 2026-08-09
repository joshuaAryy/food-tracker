import { describe, expect, it } from 'vitest';
import { analyticsMetricsForMode } from '@food-tracker/shared';
import { searchAnalyticsMetrics } from './nutrient-search';

describe('analytics nutrient search', () => {
  it('finds vitamin nutrients incrementally', () => {
    expect(searchAnalyticsMetrics('vit').map((metric) => metric.key)).toContain(
      'vitaminC',
    );
    expect(searchAnalyticsMetrics('vit c')[0]?.key).toBe('vitaminC');
  });

  it('normalizes punctuation and accepts one-edit discovery for long tokens', () => {
    expect(searchAnalyticsMetrics('omega 3')[0]?.key).toBe('omega3');
    expect(searchAnalyticsMetrics('protien')[0]?.key).toBe('protein');
  });

  it('is deterministic and keeps Simple restrictions outside the full Complex catalog', () => {
    const first = searchAnalyticsMetrics('iron').map((metric) => metric.key);
    expect(searchAnalyticsMetrics('iron').map((metric) => metric.key)).toEqual(
      first,
    );
    expect(first).toContain('iron');
  });

  it('searches only the catalog the backend allowed for the current mode', () => {
    expect(
      searchAnalyticsMetrics('vit', analyticsMetricsForMode('simple')),
    ).toEqual([]);
  });
});
