import type { AnalyticsCache } from './analytics-cache';
import { getNativeAnalyticsCache } from './analytics-cache-native';

export const ANALYTICS_CACHE_KEYS = {
  insightsWeek: 'insights-week',
  insightsMonth: 'insights-month',
  trend: (queryKey: string) => `trend-${encodeURIComponent(queryKey)}`,
} as const;

export function analyticsCache(): AnalyticsCache {
  return getNativeAnalyticsCache();
}

export function purgeAnalyticsCache(userId: string): Promise<void> {
  return analyticsCache().purge(userId);
}
