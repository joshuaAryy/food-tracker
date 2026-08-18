import { describe, expect, it } from 'vitest';
import type { ReportsResponse } from '@food-tracker/shared';
import {
  comparisonSentences,
  formatMetricValue,
  formatMetricWithUnit,
} from './reporting-ui';

describe('metric presentation formatting', () => {
  it('rounds floating-point noise without changing the source value', () => {
    expect(formatMetricValue(124.4857142857143)).toBe('124.5');
    expect(formatMetricValue(92.85714285714286)).toBe('92.9');
  });

  it('preserves explicit zero and represents unknown values as a gap', () => {
    expect(formatMetricValue(0)).toBe('0');
    expect(formatMetricValue(null)).toBe('—');
    expect(formatMetricValue(undefined)).toBe('—');
  });

  it('supports metric-specific precision and units', () => {
    expect(
      formatMetricWithUnit(2184.4, 'kcal', { maximumFractionDigits: 0 }),
    ).toBe('2,184 kcal');
    expect(formatMetricWithUnit(96, 'mg', { maximumFractionDigits: 0 })).toBe(
      '96 mg',
    );
    expect(formatMetricWithUnit(null, 'lb')).toBe('—');
  });

  it('formats comparison deltas without leaking floating-point noise', () => {
    const comparison: ReportsResponse['comparison'] = {
      currentBoundary: { startDate: '2026-08-01', endDate: '2026-08-07' },
      previousEquivalentBoundary: {
        startDate: '2026-07-25',
        endDate: '2026-07-31',
      },
      consistency: {
        current: 92.85714285714286,
        previous: 0,
        delta: 92.85714285714286,
      },
      averageProteinGrams: {
        current: 0,
        previous: 124.4857142857143,
        delta: -124.4857142857143,
      },
    };

    expect(comparisonSentences(comparison)).toEqual([
      'Consistency increased by 92.9 percentage points.',
      'Average protein decreased by 124.5 grams.',
    ]);
  });
});
