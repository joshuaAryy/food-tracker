import { describe, expect, it } from 'vitest';
import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { analyticsSectionViewModel } from './analytics-section-view-model';

describe('analytics section view model', () => {
  it('keeps a committed section visible while a replacement is pending or failed', () => {
    const data: CanonicalTrendResponse = {
      timezone: 'America/Toronto',
      trackingMode: 'simple' as const,
      primaryMetric: 'calories' as const,
      aggregation: 'daily' as const,
      resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-07' },
      firstEligibleDate: null,
      today: '2026-08-07',
      reference: {
        kind: 'none' as const,
        unit: 'kcal',
        reason: 'not_configured' as const,
      },
      interpretation: null,
      relatedMetrics: [],
      points: [],
      summary: { numericDayCount: 0, average: null },
    };
    expect(
      analyticsSectionViewModel({
        data,
        fetchedAt: '2026-08-07T12:00:00.000Z',
        status: 'stale',
        error:
          'This analytics section is temporarily unavailable. Please try again.',
        retryable: true,
      }),
    ).toEqual({
      data,
      status: 'stale',
      error:
        'This analytics section is temporarily unavailable. Please try again.',
      retryable: true,
    });
  });

  it('does not invent a numeric value for an unavailable section', () => {
    expect(analyticsSectionViewModel(undefined)).toEqual({
      data: null,
      status: 'unavailable',
      error: null,
      retryable: false,
    });
  });
});
