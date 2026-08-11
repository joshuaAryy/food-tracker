import {
  canonicalInsightsResponseV2Schema,
  type AnalyticsMetricKey,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { parseApiResponse } from '../../mobile/src/lib/api-response.js';

function trend(
  primaryMetric: AnalyticsMetricKey,
  trackingMode: 'simple' | 'complex' = 'simple',
): CanonicalTrendResponse {
  return {
    timezone: 'America/New_York',
    trackingMode,
    primaryMetric,
    aggregation: 'daily',
    resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
    firstEligibleDate: null,
    today: '2026-08-07',
    reference: { kind: 'none', unit: 'kcal', reason: 'not_configured' },
    interpretation: null,
    relatedMetrics: [],
    points: [],
    summary: { numericDayCount: 0, average: null },
  };
}

function responseFor(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function overview() {
  return {
    periodSummary: {
      status: 'available' as const,
      fetchedAt: '2026-08-11T12:00:00.000Z',
      data: {
        resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
        loggedDayCount: 2,
        eligibleDayCount: 7,
        streak: { currentDays: 1, longestDays: 2 },
        currentDayPhase: 'in_progress' as const,
        consistency: 29,
        interpretation: 'building' as const,
      },
    },
    energy: {
      status: 'available' as const,
      fetchedAt: '2026-08-11T12:00:00.000Z',
      data: {
        average: 1846,
        numericDayCount: 2,
        reference: {
          kind: 'range' as const,
          lower: 1800,
          upper: 2200,
          unit: 'kcal' as const,
          source: 'user' as const,
        },
        withinRangeDayCount: 1,
        comparison: { direction: 'up' as const, percentage: 3 },
        status: 'within_range' as const,
      },
    },
    macros: {
      status: 'available' as const,
      fetchedAt: '2026-08-11T12:00:00.000Z',
      data: {
        protein: { grams: 149, percentage: 24 },
        carbs: { grams: 269, percentage: 49 },
        fat: { grams: 49, percentage: 27 },
        status: 'recorded' as const,
      },
    },
    nutrientHighlights: {
      status: 'available' as const,
      fetchedAt: '2026-08-11T12:00:00.000Z',
      data: {
        highlights: [
          {
            metric: 'fiber' as const,
            value: 28.9,
            unit: 'g' as const,
            availability: 'recorded' as const,
            reference: {
              kind: 'minimum' as const,
              value: 30,
              unit: 'g' as const,
              source: 'derived' as const,
            },
            status: 'below_minimum' as const,
          },
          {
            metric: 'sodium' as const,
            value: 2516,
            unit: 'mg' as const,
            availability: 'recorded' as const,
            reference: {
              kind: 'limit' as const,
              value: 2300,
              unit: 'mg' as const,
              source: 'default' as const,
            },
            status: 'above_limit' as const,
          },
          {
            metric: 'vitaminC' as const,
            value: 96,
            unit: 'mg' as const,
            availability: 'recorded' as const,
            reference: {
              kind: 'minimum' as const,
              value: 75,
              unit: 'mg' as const,
              source: 'derived' as const,
            },
            status: 'meets_minimum' as const,
          },
        ],
      },
    },
    hydration: {
      status: 'available' as const,
      fetchedAt: '2026-08-11T12:00:00.000Z',
      data: {
        today: '2026-08-07',
        total: 1630,
        goal: 2000,
        status: 'below_goal' as const,
        trendSection: 'hydration' as const,
      },
    },
    weight: {
      status: 'available' as const,
      fetchedAt: '2026-08-11T12:00:00.000Z',
      data: {
        current: 129.4,
        availability: 'recorded' as const,
        change: { periodDays: 30, value: 1.7, direction: 'up' as const },
        reference: {
          kind: 'target' as const,
          value: 125,
          unit: 'lb' as const,
          source: 'user' as const,
        },
        goalPathStatus: 'moving_away' as const,
        forecast: {
          status: 'failed' as const,
          code: 'section_unavailable' as const,
          retryable: true as const,
        },
      },
    },
    loggingConsistency: {
      status: 'available' as const,
      fetchedAt: '2026-08-11T12:00:00.000Z',
      data: {
        completeDayCount: 1,
        partialDayCount: 1,
        unloggedDayCount: 5,
        inProgressDayCount: 1,
        eligibleDayCount: 7,
        streak: { currentDays: 1, longestDays: 2 },
        days: [
          {
            date: '2026-08-07',
            loggingDayState: 'partial' as const,
            loggingDayPhase: 'in_progress' as const,
          },
        ],
      },
    },
  };
}

describe('canonical Insights response v2 contract', () => {
  it('strictly accepts available, failed, and mixed section results', () => {
    const result = canonicalInsightsResponseV2Schema.safeParse({
      contractVersion: 2,
      mode: 'simple',
      period: 'week',
      sections: {
        calories: {
          status: 'available',
          data: trend('calories'),
          fetchedAt: '2026-08-11T12:00:00.000Z',
        },
        hydration: {
          status: 'failed',
          code: 'section_unavailable',
          retryable: true,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it('strictly accepts independent typed overview outcomes including a failed nested Weight forecast', () => {
    const result = canonicalInsightsResponseV2Schema.safeParse({
      contractVersion: 2,
      mode: 'simple',
      period: 'week',
      sections: {
        calories: {
          status: 'available',
          data: trend('calories'),
          fetchedAt: '2026-08-11T12:00:00.000Z',
        },
      },
      overview: overview(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid overview nutrient identities, references, and statuses', () => {
    const valid = overview();
    const invalidIdentity: unknown = {
      ...valid,
      nutrientHighlights: {
        ...valid.nutrientHighlights,
        data: {
          ...valid.nutrientHighlights.data,
          highlights: [
            {
              ...valid.nutrientHighlights.data.highlights[0],
              metric: 'protein',
            },
            valid.nutrientHighlights.data.highlights[1],
            valid.nutrientHighlights.data.highlights[2],
          ],
        },
      },
    };
    const invalidReference: unknown = {
      ...valid,
      nutrientHighlights: {
        ...valid.nutrientHighlights,
        data: {
          ...valid.nutrientHighlights.data,
          highlights: [
            valid.nutrientHighlights.data.highlights[0],
            {
              ...valid.nutrientHighlights.data.highlights[1],
              reference: {
                kind: 'target',
                value: 2300,
                unit: 'mg',
                source: 'default',
              },
            },
            valid.nutrientHighlights.data.highlights[2],
          ],
        },
      },
    };
    const invalidStatus: unknown = {
      ...valid,
      nutrientHighlights: {
        ...valid.nutrientHighlights,
        data: {
          ...valid.nutrientHighlights.data,
          highlights: [
            valid.nutrientHighlights.data.highlights[0],
            valid.nutrientHighlights.data.highlights[1],
            {
              ...valid.nutrientHighlights.data.highlights[2],
              status: 'above_limit',
            },
          ],
        },
      },
    };

    for (const invalidOverview of [
      invalidIdentity,
      invalidReference,
      invalidStatus,
    ]) {
      expect(
        canonicalInsightsResponseV2Schema.safeParse({
          contractVersion: 2,
          mode: 'simple',
          period: 'week',
          sections: {
            calories: {
              status: 'available',
              data: trend('calories'),
              fetchedAt: '2026-08-11T12:00:00.000Z',
            },
          },
          overview: invalidOverview,
        }).success,
      ).toBe(false);
    }
  });

  it('rejects malformed result envelopes and unknown fields rather than producing a partial report', () => {
    expect(
      canonicalInsightsResponseV2Schema.safeParse({
        contractVersion: 2,
        mode: 'simple',
        period: 'week',
        sections: {
          calories: { status: 'available', data: trend('calories') },
        },
      }).success,
    ).toBe(false);
    expect(
      canonicalInsightsResponseV2Schema.safeParse({
        contractVersion: 2,
        mode: 'simple',
        period: 'week',
        sections: {},
        backendCategory: 'database',
      }).success,
    ).toBe(false);
  });

  it('rejects an empty successful report', () => {
    expect(
      canonicalInsightsResponseV2Schema.safeParse({
        contractVersion: 2,
        mode: 'simple',
        period: 'week',
        sections: {},
      }).success,
    ).toBe(false);
  });

  it('rejects a section whose key does not match its primary metric', () => {
    expect(
      canonicalInsightsResponseV2Schema.safeParse({
        contractVersion: 2,
        mode: 'simple',
        period: 'week',
        sections: {
          calories: {
            status: 'available',
            data: trend('hydration'),
            fetchedAt: '2026-08-11T12:00:00.000Z',
          },
        },
      }).success,
    ).toBe(false);
  });

  it('rejects available trends whose tracking mode differs from the envelope', () => {
    expect(
      canonicalInsightsResponseV2Schema.safeParse({
        contractVersion: 2,
        mode: 'simple',
        period: 'week',
        sections: {
          calories: {
            status: 'available',
            data: trend('calories', 'complex'),
            fetchedAt: '2026-08-11T12:00:00.000Z',
          },
        },
      }).success,
    ).toBe(false);
  });

  it('keeps malformed v2 parser failures report-level', async () => {
    await expect(
      parseApiResponse(
        responseFor({
          contractVersion: 2,
          mode: 'simple',
          period: 'week',
          sections: {
            calories: {
              status: 'failed',
              code: 'database_down',
              retryable: true,
            },
          },
        }),
        canonicalInsightsResponseV2Schema,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('rejects a malformed mixed response at the report parser boundary', async () => {
    await expect(
      parseApiResponse(
        responseFor({
          contractVersion: 2,
          mode: 'simple',
          period: 'week',
          sections: {
            calories: {
              status: 'available',
              data: trend('hydration'),
              fetchedAt: '2026-08-11T12:00:00.000Z',
            },
            hydration: {
              status: 'failed',
              code: 'section_unavailable',
              retryable: true,
            },
          },
        }),
        canonicalInsightsResponseV2Schema,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
