import type { AnalyticsCache } from './analytics-cache';
import { createNativeAnalyticsCache } from './analytics-cache-native';

export const ANALYTICS_CACHE_KEYS = {
  insightsWeek: 'insights-week',
  insightsMonth: 'insights-month',
  trend: (queryKey: string) => `trend-${encodeURIComponent(queryKey)}`,
} as const;

const STALE_AFTER_MS = 15 * 60 * 1000;
let cache: AnalyticsCache | null = null;

export function analyticsCache(): AnalyticsCache {
  cache ??= createNativeAnalyticsCache(STALE_AFTER_MS);
  return cache;
}
