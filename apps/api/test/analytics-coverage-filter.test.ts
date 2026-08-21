import { describe, expect, it } from 'vitest';
import { includesLoggingDay } from '../src/modules/analytics/trends/coverage-filter.js';

describe('analytics coverage filters', () => {
  it('filters only logging completeness and leaves metric availability independent', () => {
    const completeUnknownMetric = {
      loggingDayState: 'complete' as const,
      loggingDayPhase: 'closed' as const,
      metricDataState: 'unknown' as const,
    };

    expect(includesLoggingDay(completeUnknownMetric, 'all_logged_days')).toBe(
      true,
    );
    expect(
      includesLoggingDay(completeUnknownMetric, 'complete_and_partial'),
    ).toBe(true);
    expect(includesLoggingDay(completeUnknownMetric, 'complete_only')).toBe(
      true,
    );
  });

  it('admits logged in-progress days only through all_logged_days', () => {
    const inProgress = {
      loggingDayState: 'partial' as const,
      loggingDayPhase: 'in_progress' as const,
      metricDataState: 'recorded' as const,
    };

    expect(includesLoggingDay(inProgress, 'all_logged_days')).toBe(true);
    expect(includesLoggingDay(inProgress, 'complete_and_partial')).toBe(false);
    expect(includesLoggingDay(inProgress, 'complete_only')).toBe(false);
  });

  it('never treats unlogged days as numerically included', () => {
    expect(
      includesLoggingDay(
        {
          loggingDayState: 'unlogged',
          loggingDayPhase: 'closed',
          metricDataState: null,
        },
        'all_logged_days',
      ),
    ).toBe(false);
  });
});
