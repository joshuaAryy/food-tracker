import { describe, expect, it } from 'vitest';
import {
  resolveAnalyticsAggregation,
  resolveAnalyticsPeriod,
} from '../src/modules/analytics/trends/ranges.js';
import { referenceFromBounds } from '../src/modules/analytics/trends/references.js';

describe('analytics range engine', () => {
  it('uses approved automatic aggregation defaults', () => {
    expect(resolveAnalyticsAggregation({ kind: 'relative', days: 7 })).toBe(
      'daily',
    );
    expect(resolveAnalyticsAggregation({ kind: 'relative', days: 30 })).toBe(
      'daily',
    );
    expect(resolveAnalyticsAggregation({ kind: 'relative', days: 90 })).toBe(
      'weekly',
    );
    expect(
      resolveAnalyticsAggregation({
        kind: 'custom',
        startDate: '2026-01-01',
        endDate: '2026-07-31',
      }),
    ).toBe('monthly');
  });

  it('validates custom ranges against today and first eligible data', () => {
    expect(
      resolveAnalyticsPeriod({
        period: { kind: 'relative', days: 7 },
        today: '2026-08-08',
        firstEligibleDate: '2026-08-01',
      }),
    ).toMatchObject({ startDate: '2026-08-02', endDate: '2026-08-08' });

    expect(() =>
      resolveAnalyticsPeriod({
        period: {
          kind: 'custom',
          startDate: '2026-07-31',
          endDate: '2026-08-08',
        },
        today: '2026-08-08',
        firstEligibleDate: '2026-08-01',
      }),
    ).toThrow('first eligible');
    expect(() =>
      resolveAnalyticsPeriod({
        period: {
          kind: 'custom',
          startDate: '2026-08-07',
          endDate: '2026-08-06',
        },
        today: '2026-08-08',
        firstEligibleDate: '2026-08-01',
      }),
    ).toThrow('must not follow');
    expect(() =>
      resolveAnalyticsPeriod({
        period: {
          kind: 'custom',
          startDate: '2026-08-07',
          endDate: '2026-08-09',
        },
        today: '2026-08-08',
        firstEligibleDate: '2026-08-01',
      }),
    ).toThrow('future');
  });

  it('keeps a relative window full length when eligibility begins inside it', () => {
    for (const days of [7, 30, 90]) {
      expect(
        resolveAnalyticsPeriod({
          period: { kind: 'relative', days },
          today: '2026-08-08',
          firstEligibleDate: '2026-08-06',
        }),
      ).toMatchObject({
        startDate: `2026-${days === 90 ? '05-11' : days === 30 ? '07-10' : '08-02'}`,
        endDate: '2026-08-08',
        dayCount: days,
      });
    }
  });

  it('preserves target, minimum, limit, and true range semantics without fabricating bounds', () => {
    expect(
      referenceFromBounds({ unit: 'mg', lower: 60, upper: 90, source: 'user' }),
    ).toEqual({
      kind: 'range',
      lower: 60,
      upper: 90,
      unit: 'mg',
      source: 'user',
    });
    expect(
      referenceFromBounds({ unit: 'g', target: 150, source: 'user' }),
    ).toEqual({ kind: 'target', value: 150, unit: 'g', source: 'user' });
    expect(
      referenceFromBounds({ unit: 'mg', minimum: 400, source: 'default' }),
    ).toEqual({ kind: 'minimum', value: 400, unit: 'mg', source: 'default' });
    expect(
      referenceFromBounds({ unit: 'mg', limit: 2300, source: 'default' }),
    ).toEqual({ kind: 'limit', value: 2300, unit: 'mg', source: 'default' });
    expect(() =>
      referenceFromBounds({ unit: 'mg', lower: 60, source: 'user' }),
    ).toThrow('both lower and upper');
  });
});
