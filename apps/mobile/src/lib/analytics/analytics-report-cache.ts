import {
  canonicalInsightsResponseV2WithOverviewSchema,
  type CanonicalInsightsResponseV2WithOverview,
} from '@food-tracker/shared';

export function insightsCacheKey(period: 'week' | 'month'): string {
  return period === 'week' ? 'insights-v2-week' : 'insights-v2-month';
}

/**
 * Only a complete, schema-validated v2 envelope can hydrate the section-aware
 * resource. Older v1 envelopes stay in their old keys and are never rewritten
 * in place as v2.
 */
export function isInsightsV2CachePayload(
  value: unknown,
): value is CanonicalInsightsResponseV2WithOverview {
  return canonicalInsightsResponseV2WithOverviewSchema.safeParse(value).success;
}
