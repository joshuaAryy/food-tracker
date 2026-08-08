import type { AnalyticsMetricKey } from '@food-tracker/shared';

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
