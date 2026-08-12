import {
  canonicalInsightsResponseV2Schema,
  canonicalInsightsResponseV2WithOverviewSchema,
  canonicalInsightsResponseWithOverviewSchema,
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
        todaySoFar: {
          date: '2026-08-07',
          mealCount: 2,
          calories: { value: 1846, state: 'recorded' as const },
          protein: { value: 149, state: 'recorded' as const },
        },
        loggedDayCount: 2,
        eligibleLoggedDayCount: 2,
        eligibleTotalDayCount: 7,
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
        timezone: 'America/New_York',
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
        eligibleLoggedDayCount: 2,
        eligibleTotalDayCount: 7,
        streak: { currentDays: 1, longestDays: 2 },
        days: [
          {
            date: '2026-08-01',
            loggingDayState: 'complete' as const,
            loggingDayPhase: 'closed' as const,
          },
          {
            date: '2026-08-02',
            loggingDayState: 'partial' as const,
            loggingDayPhase: 'closed' as const,
          },
          {
            date: '2026-08-03',
            loggingDayState: 'unlogged' as const,
            loggingDayPhase: 'closed' as const,
          },
          {
            date: '2026-08-04',
            loggingDayState: 'unlogged' as const,
            loggingDayPhase: 'closed' as const,
          },
          {
            date: '2026-08-05',
            loggingDayState: 'unlogged' as const,
            loggingDayPhase: 'closed' as const,
          },
          {
            date: '2026-08-06',
            loggingDayState: 'unlogged' as const,
            loggingDayPhase: 'closed' as const,
          },
          {
            date: '2026-08-07',
            loggingDayState: 'unlogged' as const,
            loggingDayPhase: 'in_progress' as const,
          },
        ],
      },
    },
  };
}

describe('canonical Insights response v2 contract', () => {
  it('accepts the temporary flat transport bridge with required overview outcomes', () => {
    const result = canonicalInsightsResponseWithOverviewSchema.safeParse({
      mode: 'simple',
      period: 'week',
      sections: { calories: trend('calories') },
      overview: overview(),
    });

    expect(result.success).toBe(true);
    expect(
      canonicalInsightsResponseWithOverviewSchema.safeParse({
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
      }).success,
    ).toBe(false);
  });

  it('accepts every authoritative nutrient reference variant in the flat bridge', () => {
    const valid = overview();
    const candidate = {
      ...valid,
      nutrientHighlights: {
        ...valid.nutrientHighlights,
        data: {
          highlights: [
            {
              ...valid.nutrientHighlights.data.highlights[0],
              value: 30,
              reference: {
                kind: 'target' as const,
                value: 30,
                unit: 'g' as const,
                source: 'user' as const,
              },
              status: 'meets_target' as const,
            },
            {
              ...valid.nutrientHighlights.data.highlights[1],
              value: 2300,
              reference: {
                kind: 'range' as const,
                lower: 2000,
                upper: 2400,
                unit: 'mg' as const,
                source: 'derived' as const,
              },
              status: 'within_range' as const,
            },
            {
              ...valid.nutrientHighlights.data.highlights[2],
              value: null,
              availability: 'unknown' as const,
              reference: {
                kind: 'none' as const,
                unit: 'mg' as const,
                reason: 'not_configured' as const,
              },
              status: 'unknown' as const,
            },
          ],
        },
      },
    };

    expect(
      canonicalInsightsResponseWithOverviewSchema.safeParse({
        mode: 'simple',
        period: 'week',
        sections: { calories: trend('calories') },
        overview: candidate,
      }).success,
    ).toBe(true);
  });

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

  it('rejects contradictory overview facts instead of normalizing them on mobile', () => {
    const valid = overview();
    const responseForOverview = (candidate: unknown) => ({
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
      overview: candidate,
    });
    const reversedRange = {
      ...valid,
      periodSummary: {
        ...valid.periodSummary,
        data: {
          ...valid.periodSummary.data,
          resolvedRange: { startDate: '2026-08-07', endDate: '2026-08-01' },
        },
      },
    };
    const inconsistentSummary = {
      ...valid,
      periodSummary: {
        ...valid.periodSummary,
        data: {
          ...valid.periodSummary.data,
          eligibleLoggedDayCount: 8,
          consistency: 101,
        },
      },
    };
    const invalidEnergy = {
      ...valid,
      energy: {
        ...valid.energy,
        data: {
          ...valid.energy.data,
          reference: {
            ...valid.energy.data.reference,
            lower: 2400,
            upper: 1800,
          },
          numericDayCount: 1,
          withinRangeDayCount: 2,
          status: 'no_reference',
        },
      },
    };
    const invalidHydration = {
      ...valid,
      hydration: {
        ...valid.hydration,
        data: { ...valid.hydration.data, total: null, status: 'goal_met' },
      },
    };
    const invalidWeight = {
      ...valid,
      weight: {
        ...valid.weight,
        data: {
          ...valid.weight.data,
          current: null,
          availability: 'recorded',
          change: { ...valid.weight.data.change, value: null, direction: 'up' },
          reference: { kind: 'none', unit: 'lb', reason: 'not_configured' },
          goalPathStatus: 'at_goal',
        },
      },
    };
    const invalidLoggingCounts = {
      ...valid,
      loggingConsistency: {
        ...valid.loggingConsistency,
        data: {
          ...valid.loggingConsistency.data,
          completeDayCount: 2,
          eligibleLoggedDayCount: 8,
          eligibleTotalDayCount: 1,
        },
      },
    };
    const invalidForecast = {
      ...valid,
      weight: {
        ...valid.weight,
        data: {
          ...valid.weight.data,
          forecast: {
            status: 'available',
            fetchedAt: '2026-08-11T12:00:00.000Z',
            data: {
              todayDate: '2026-08-07',
              horizonDays: 1,
              points: [
                { date: '2026-08-08', value: 130, lower: 131, upper: 132 },
              ],
            },
          },
        },
      },
    };
    const invalidNutrientStatus = {
      ...valid,
      nutrientHighlights: {
        ...valid.nutrientHighlights,
        data: {
          ...valid.nutrientHighlights.data,
          highlights: [
            {
              ...valid.nutrientHighlights.data.highlights[0],
              value: 40,
              status: 'below_minimum',
            },
            valid.nutrientHighlights.data.highlights[1],
            valid.nutrientHighlights.data.highlights[2],
          ],
        },
      },
    };
    const invalidMacros = {
      ...valid,
      macros: {
        ...valid.macros,
        data: {
          ...valid.macros.data,
          status: 'unknown',
          protein: { grams: null, percentage: 20 },
        },
      },
    };
    const invalidLoggingDays = {
      ...valid,
      loggingConsistency: {
        ...valid.loggingConsistency,
        data: {
          ...valid.loggingConsistency.data,
          days: [
            valid.loggingConsistency.data.days[0]!,
            valid.loggingConsistency.data.days[0]!,
            ...valid.loggingConsistency.data.days.slice(2),
          ],
        },
      },
    };

    for (const candidate of [
      reversedRange,
      inconsistentSummary,
      invalidEnergy,
      invalidHydration,
      invalidWeight,
      invalidLoggingCounts,
      invalidForecast,
      invalidNutrientStatus,
      invalidMacros,
      invalidLoggingDays,
    ]) {
      expect(
        canonicalInsightsResponseV2Schema.safeParse(
          responseForOverview(candidate),
        ).success,
      ).toBe(false);
    }
  });

  it('requires every overview ownership boundary when an overview is present', () => {
    const partialOverview: Record<string, unknown> = { ...overview() };
    delete partialOverview.hydration;
    expect(
      canonicalInsightsResponseV2Schema.safeParse({
        contractVersion: 2,
        mode: 'simple',
        period: 'week',
        sections: {
          calories: {
            status: 'failed',
            code: 'section_unavailable',
            retryable: true,
          },
        },
        overview: partialOverview,
      }).success,
    ).toBe(false);
  });

  it('uses the overview-required schema for the recovered production Insights route', () => {
    const coreOnly = {
      contractVersion: 2,
      mode: 'simple',
      period: 'week',
      sections: {
        calories: {
          status: 'available' as const,
          data: trend('calories'),
          fetchedAt: '2026-08-11T12:00:00.000Z',
        },
      },
    };
    expect(canonicalInsightsResponseV2Schema.safeParse(coreOnly).success).toBe(
      true,
    );
    expect(
      canonicalInsightsResponseV2WithOverviewSchema.safeParse(coreOnly).success,
    ).toBe(false);
    expect(
      canonicalInsightsResponseV2WithOverviewSchema.safeParse({
        ...coreOnly,
        overview: overview(),
      }).success,
    ).toBe(true);
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
