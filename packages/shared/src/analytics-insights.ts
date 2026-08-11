import { z } from 'zod';
import {
  canonicalInsightsResponseSchema,
  canonicalTrendResponseSchema,
  type CanonicalTrendResponse,
} from './analytics-trends.js';

export const ANALYTICS_INSIGHTS_SECTION_KEYS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
  'weight',
  'hydration',
  'loggingConsistency',
] as const;

export type AnalyticsSectionKey =
  (typeof ANALYTICS_INSIGHTS_SECTION_KEYS)[number];

export const analyticsSectionKeySchema = z.enum(
  ANALYTICS_INSIGHTS_SECTION_KEYS,
);

export type AnalyticsSectionResult<T = CanonicalTrendResponse> =
  | { status: 'available'; data: T; fetchedAt: string }
  | {
      status: 'failed';
      code: 'section_unavailable';
      retryable: true;
    };

export const analyticsSectionResultSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('available'),
    data: canonicalTrendResponseSchema,
    fetchedAt: z.iso.datetime({ offset: true }),
  }),
  z.strictObject({
    status: z.literal('failed'),
    code: z.literal('section_unavailable'),
    retryable: z.literal(true),
  }),
]);

export interface CanonicalInsightsResponseV2 {
  contractVersion: 2;
  mode: 'simple' | 'complex';
  period: 'week' | 'month';
  sections: Partial<
    Record<AnalyticsSectionKey, AnalyticsSectionResult<CanonicalTrendResponse>>
  >;
}

export const canonicalInsightsResponseV2Schema = z.strictObject({
  contractVersion: z.literal(2),
  mode: z.enum(['simple', 'complex']),
  period: z.enum(['week', 'month']),
  sections: z.partialRecord(
    analyticsSectionKeySchema,
    analyticsSectionResultSchema,
  ),
});

/** Validates legacy reports before a caller can normalize them into v2. */
export function parseCanonicalInsightsResponseV1(value: unknown) {
  return canonicalInsightsResponseSchema.safeParse(value);
}
