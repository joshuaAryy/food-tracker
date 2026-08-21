import type { AnalyticsMetricKey } from '@food-tracker/shared';

export function trendRouteForProgressMetric(
  metric: AnalyticsMetricKey,
): string {
  return `/trends/${metric}`;
}

export function caloriesTrendRoute(): string {
  return trendRouteForProgressMetric('calories');
}

export function weightTrendRoute(): string {
  return trendRouteForProgressMetric('weight');
}

export function loggingConsistencyTrendRoute(): string {
  return trendRouteForProgressMetric('loggingConsistency');
}

export function insightsRoute(): string {
  return '/(tabs)/insights';
}
