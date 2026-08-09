import { describe, expect, it } from 'vitest';
import { canonicalTrendResponseSchema } from '@food-tracker/shared';

const response = {
  timezone: 'America/New_York',
  trackingMode: 'complex',
  primaryMetric: 'calories',
  aggregation: 'daily',
  resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
  firstEligibleDate: '2026-08-01',
  today: '2026-08-07',
  reference: { kind: 'target', value: 2000, unit: 'kcal', source: 'user' },
  interpretation: null,
  relatedMetrics: [],
  points: [
    {
      kind: 'daily',
      date: '2026-08-01',
      loggingDayState: 'complete',
      loggingDayPhase: 'closed',
      metricDataState: 'recorded',
      value: 2000,
      foodLogCount: 3,
      metricRecordedLogCount: 3,
      metricUnknownLogCount: 0,
    },
  ],
  summary: { numericDayCount: 1, average: 2000 },
};

describe('canonical analytics trend contract', () => {
  it('validates complete chart data and rejects malformed daily states', () => {
    expect(canonicalTrendResponseSchema.safeParse(response).success).toBe(true);
    expect(
      canonicalTrendResponseSchema.safeParse({
        ...response,
        points: [{ ...response.points[0], loggingDayState: 'unknown' }],
      }).success,
    ).toBe(false);
  });
});
