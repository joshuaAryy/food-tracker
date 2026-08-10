import {
  analyticsMetricKeySchema,
  canonicalInsightsResponseSchema,
  canonicalTrendResponseSchema,
  type AnalyticsMetricKey,
  type CanonicalInsightsResponse,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  parseApiResponse,
  type ResponseSchema,
} from '../../mobile/src/lib/api-response.js';

const canonicalMetricKeys = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
  'weight',
  'hydration',
  'loggingConsistency',
] as const satisfies readonly AnalyticsMetricKey[];

function trend(primaryMetric: AnalyticsMetricKey): CanonicalTrendResponse {
  const unit =
    primaryMetric === 'weight'
      ? 'lb'
      : primaryMetric === 'hydration'
        ? 'mL'
        : primaryMetric === 'loggingConsistency'
          ? 'percent'
          : primaryMetric === 'macroComposition'
            ? 'composition'
            : 'g';
  return {
    timezone: 'America/Toronto',
    trackingMode: 'simple',
    primaryMetric,
    aggregation: 'daily',
    resolvedRange: {
      startDate: '2026-08-01',
      endDate: '2026-08-07',
    },
    firstEligibleDate: null,
    today: '2026-08-07',
    reference: {
      kind: 'none',
      unit,
      reason: 'not_configured',
    },
    interpretation: null,
    relatedMetrics: [],
    points: [],
    summary: {
      numericDayCount: 0,
      average: null,
    },
  };
}

const canonicalInsightsResponse = {
  mode: 'simple',
  period: 'week',
  sections: {
    calories: trend('calories'),
    protein: trend('protein'),
    carbs: trend('carbs'),
    fat: trend('fat'),
    macroComposition: trend('macroComposition'),
    weight: trend('weight'),
    hydration: trend('hydration'),
    loggingConsistency: trend('loggingConsistency'),
  },
} satisfies CanonicalInsightsResponse;

function responseFor(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('canonical Insights response contract', () => {
  it('accepts the exact eight-section server response', () => {
    expect(Object.keys(canonicalInsightsResponse.sections)).toEqual(
      canonicalMetricKeys,
    );
    const result = canonicalInsightsResponseSchema.safeParse(
      canonicalInsightsResponse,
    );

    expect(result.success).toBe(true);
  });

  it('characterizes exhaustive Zod enum-record failure as missing section keys', () => {
    const exhaustiveSchema = z.object({
      mode: z.enum(['simple', 'complex']),
      period: z.enum(['week', 'month']),
      sections: z.record(
        analyticsMetricKeySchema,
        canonicalTrendResponseSchema,
      ),
    });
    const result = exhaustiveSchema.safeParse(canonicalInsightsResponse);
    const missingKeys = analyticsMetricKeySchema.options.filter(
      (key) => !(key in canonicalInsightsResponse.sections),
    );

    expect(missingKeys.length).toBeGreaterThan(0);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toHaveLength(missingKeys.length);
    expect(result.error.issues).toEqual(
      expect.arrayContaining(
        missingKeys.map((key) =>
          expect.objectContaining({
            path: ['sections', key],
          }),
        ),
      ),
    );
  });

  it('accepts the same envelope through the mobile response parser', async () => {
    const diagnostics: string[] = [];
    const parsed = await parseApiResponse(
      responseFor(canonicalInsightsResponse),
      canonicalInsightsResponseSchema,
      (event) => diagnostics.push(event),
    );

    expect(parsed).toEqual(canonicalInsightsResponse);
    expect(diagnostics).toContain('response_schema_parsed');
    expect(diagnostics).not.toContain('response_schema_parse_failed');
  });

  it('accepts a valid subset of analytics sections', () => {
    const result = canonicalInsightsResponseSchema.safeParse({
      ...canonicalInsightsResponse,
      sections: {
        calories: canonicalInsightsResponse.sections.calories,
        hydration: canonicalInsightsResponse.sections.hydration,
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid analytics section key', () => {
    const result = canonicalInsightsResponseSchema.safeParse({
      ...canonicalInsightsResponse,
      sections: {
        ...canonicalInsightsResponse.sections,
        notAnAnalyticsMetric: trend('calories'),
      },
    });

    expect(result.success).toBe(false);
  });

  it('validates every provided section with the canonical trend schema', () => {
    const result = canonicalInsightsResponseSchema.safeParse({
      ...canonicalInsightsResponse,
      sections: {
        ...canonicalInsightsResponse.sections,
        protein: {
          ...canonicalInsightsResponse.sections.protein,
          today: 'not-a-date',
        },
      },
    });

    expect(result.success).toBe(false);
    expect(
      canonicalTrendResponseSchema.safeParse(trend('protein')).success,
    ).toBe(true);
    expect(
      canonicalTrendResponseSchema.safeParse({
        ...trend('protein'),
        today: 'not-a-date',
      }).success,
    ).toBe(false);
  });

  it('shows the old exhaustive parser behavior for the same envelope', async () => {
    const legacySchema: ResponseSchema<CanonicalInsightsResponse> = z.object({
      mode: z.enum(['simple', 'complex']),
      period: z.enum(['week', 'month']),
      sections: z.record(
        analyticsMetricKeySchema,
        canonicalTrendResponseSchema,
      ),
    }) as unknown as ResponseSchema<CanonicalInsightsResponse>;
    const diagnostics: string[] = [];

    await expect(
      parseApiResponse(
        responseFor(canonicalInsightsResponse),
        legacySchema,
        (event) => diagnostics.push(event),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(diagnostics).toContain('response_schema_parse_failed');
  });
});
