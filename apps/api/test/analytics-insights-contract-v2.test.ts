import {
  canonicalInsightsResponseV2Schema,
  type AnalyticsMetricKey,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { parseApiResponse } from '../../mobile/src/lib/api-response.js';

function trend(primaryMetric: AnalyticsMetricKey): CanonicalTrendResponse {
  return {
    timezone: 'America/New_York',
    trackingMode: 'simple',
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
});
