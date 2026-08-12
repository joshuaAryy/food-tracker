import {
  analyticsSectionKeySchema,
  ANALYTICS_OVERVIEW_KEYS,
  canonicalInsightsResponseV2Schema,
  canonicalInsightsResponseV2WithOverviewSchema,
  canonicalInsightsResponseWithOverviewSchema,
  parseCanonicalInsightsResponseV1,
  type AnalyticsSectionKey,
  type AnalyticsSectionResult,
  type CanonicalInsightsResponse,
  type CanonicalInsightsResponseWithOverview,
  type CanonicalInsightsResponseV2,
  type CanonicalInsightsResponseV2WithOverview,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';

/**
 * Temporary R1 boundary: only a complete, validated v1 success can become a
 * v2 cache candidate. The live v1 cache remains untouched until R10 owns the
 * migration flow.
 */
export function adaptCanonicalInsightsResponseV1(
  value: unknown,
  fetchedAt: string,
): CanonicalInsightsResponseV2 | null {
  const parsedV1 = parseCanonicalInsightsResponseV1(value);
  if (!parsedV1.success) return null;
  // The established v1 schema has a broader Zod output than its public
  // CanonicalInsightsResponse interface; keep that bridge after validation.
  const v1Report = parsedV1.data as CanonicalInsightsResponse;

  if (Object.keys(v1Report.sections).length === 0) return null;

  const sections: Partial<
    Record<AnalyticsSectionKey, AnalyticsSectionResult<CanonicalTrendResponse>>
  > = {};
  for (const [key, data] of Object.entries(v1Report.sections)) {
    const sectionKey = analyticsSectionKeySchema.safeParse(key);
    if (!sectionKey.success) return null;
    sections[sectionKey.data] = {
      status: 'available',
      data,
      fetchedAt,
    };
  }

  const candidate = {
    contractVersion: 2 as const,
    mode: v1Report.mode,
    period: v1Report.period,
    sections,
    overview: Object.fromEntries(
      ANALYTICS_OVERVIEW_KEYS.map((key) => [
        key,
        {
          status: 'failed' as const,
          code: 'section_unavailable' as const,
          retryable: true as const,
        },
      ]),
    ),
  };
  const parsedV2 = canonicalInsightsResponseV2Schema.safeParse(candidate);
  return parsedV2.success
    ? (parsedV2.data as CanonicalInsightsResponseV2)
    : null;
}

/**
 * Normalizes the temporary live-route bridge into the section-aware v2
 * presentation contract. The bridge owns real overview facts; this adapter
 * only wraps its already-validated flat trend sections with resource state.
 */
export function adaptCanonicalInsightsResponseWithOverview(
  value: unknown,
  fetchedAt: string,
): CanonicalInsightsResponseV2WithOverview | null {
  const parsedBridge =
    canonicalInsightsResponseWithOverviewSchema.safeParse(value);
  if (!parsedBridge.success) return null;
  const bridge = parsedBridge.data as CanonicalInsightsResponseWithOverview;

  const sections: Partial<
    Record<AnalyticsSectionKey, AnalyticsSectionResult<CanonicalTrendResponse>>
  > = {};
  for (const [key, data] of Object.entries(bridge.sections)) {
    const sectionKey = analyticsSectionKeySchema.safeParse(key);
    if (!sectionKey.success) return null;
    sections[sectionKey.data] = {
      status: 'available',
      data,
      fetchedAt,
    };
  }

  const candidate = {
    contractVersion: 2 as const,
    mode: bridge.mode,
    period: bridge.period,
    sections,
    overview: bridge.overview,
  };
  const parsedV2 =
    canonicalInsightsResponseV2WithOverviewSchema.safeParse(candidate);
  return parsedV2.success
    ? (parsedV2.data as CanonicalInsightsResponseV2WithOverview)
    : null;
}
