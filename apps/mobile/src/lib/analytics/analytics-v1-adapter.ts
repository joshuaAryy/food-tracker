import {
  analyticsSectionKeySchema,
  canonicalInsightsResponseV2Schema,
  parseCanonicalInsightsResponseV1,
  type AnalyticsSectionKey,
  type AnalyticsSectionResult,
  type CanonicalInsightsResponse,
  type CanonicalInsightsResponseV2,
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
  };
  const parsedV2 = canonicalInsightsResponseV2Schema.safeParse(candidate);
  return parsedV2.success
    ? (parsedV2.data as CanonicalInsightsResponseV2)
    : null;
}
