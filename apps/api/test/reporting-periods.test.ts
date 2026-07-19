import { describe, expect, it } from 'vitest';
import {
  comparisonWindows,
  periodBoundaries,
} from '../src/modules/analytics/reporting/periods.js';

describe('reporting period boundaries', () => {
  it('uses Sunday through Saturday weeks and an equivalent elapsed previous window', () => {
    expect(periodBoundaries('week', '2026-07-15')).toEqual({
      current: {
        startDate: '2026-07-12',
        endDate: '2026-07-18',
        elapsedThroughDate: '2026-07-15',
      },
      previousCompleted: {
        startDate: '2026-07-05',
        endDate: '2026-07-11',
        elapsedThroughDate: '2026-07-11',
      },
    });

    expect(comparisonWindows('week', '2026-07-15')).toEqual({
      current: { startDate: '2026-07-12', endDate: '2026-07-15' },
      previousEquivalent: { startDate: '2026-07-05', endDate: '2026-07-08' },
    });
  });

  it('keeps Sunday as a one-day current window and compares the prior Sunday only', () => {
    expect(comparisonWindows('week', '2026-07-12')).toEqual({
      current: { startDate: '2026-07-12', endDate: '2026-07-12' },
      previousEquivalent: { startDate: '2026-07-05', endDate: '2026-07-05' },
    });
  });

  it('caps a shorter previous month at its final calendar day', () => {
    expect(periodBoundaries('month', '2024-03-18')).toEqual({
      current: {
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        elapsedThroughDate: '2024-03-18',
      },
      previousCompleted: {
        startDate: '2024-02-01',
        endDate: '2024-02-29',
        elapsedThroughDate: '2024-02-29',
      },
    });

    expect(comparisonWindows('month', '2024-03-18')).toEqual({
      current: { startDate: '2024-03-01', endDate: '2024-03-18' },
      previousEquivalent: { startDate: '2024-02-01', endDate: '2024-02-18' },
    });
  });

  it('handles a first-of-month comparison and a non-leap February', () => {
    expect(comparisonWindows('month', '2023-03-01')).toEqual({
      current: { startDate: '2023-03-01', endDate: '2023-03-01' },
      previousEquivalent: { startDate: '2023-02-01', endDate: '2023-02-01' },
    });
  });
});
