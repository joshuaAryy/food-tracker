import { describe, expect, it } from 'vitest';
import {
  customRangeAggregationLabel,
  normalizeCustomRange,
} from './custom-range';

describe('Custom Range', () => {
  it('clamps selections to the first eligible day through today and preserves inclusive order', () => {
    expect(
      normalizeCustomRange({
        startDate: '2026-07-01',
        endDate: '2026-08-20',
        firstEligibleDate: '2026-07-10',
        today: '2026-08-08',
      }),
    ).toEqual({ startDate: '2026-07-10', endDate: '2026-08-08', days: 30 });
  });

  it('uses approved automatic aggregation thresholds', () => {
    expect(customRangeAggregationLabel(45)).toBe('Daily');
    expect(customRangeAggregationLabel(46)).toBe('Weekly');
    expect(customRangeAggregationLabel(181)).toBe('Monthly');
  });
});
