import type { AnalyticsMetricKey, TrendQueryInput } from '@food-tracker/shared';

export const simpleTrendMetrics = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
  'weight',
  'hydration',
  'loggingConsistency',
] as const satisfies readonly AnalyticsMetricKey[];

export function trendRouteForMetric(metric: AnalyticsMetricKey): string {
  return `/trends/${metric}`;
}

export function pairedTrendQuery({
  query,
  primaryMetric,
  comparisonMetric,
}: {
  query: TrendQueryInput;
  primaryMetric: AnalyticsMetricKey;
  comparisonMetric: AnalyticsMetricKey;
}): TrendQueryInput {
  return {
    ...query,
    primaryMetric,
    comparisonMetric,
  };
}

export function resolveTrendQuery({
  metric,
  restoredQuery,
  selectedRelativePeriod,
}: {
  metric: AnalyticsMetricKey;
  restoredQuery: TrendQueryInput | null;
  selectedRelativePeriod: 7 | 30 | 90 | null;
}): TrendQueryInput {
  const query = restoredQuery ?? {
    primaryMetric: metric,
    period: { kind: 'relative' as const, days: 30 },
    aggregation: 'automatic' as const,
    visualization: 'automatic' as const,
    showReference: true,
    coverageFilter: 'all_logged_days' as const,
  };
  return {
    ...query,
    primaryMetric: metric,
    period:
      selectedRelativePeriod === null
        ? query.period
        : { kind: 'relative', days: selectedRelativePeriod },
  };
}
