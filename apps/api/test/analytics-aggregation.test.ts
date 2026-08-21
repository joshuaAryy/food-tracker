import { describe, expect, it } from 'vitest';
import { aggregateAnalyticsBucket } from '../src/modules/analytics/trends/aggregation.js';
import { analyticsSectionDailyPointFixtures } from './fixtures/analytics-section-fixtures.js';

describe('analytics aggregation', () => {
  it('keeps weekly bucket states as independent counts and excludes gaps from the average', () => {
    expect(
      aggregateAnalyticsBucket({
        bucketStartDate: '2026-08-03',
        bucketEndDate: '2026-08-09',
        points: analyticsSectionDailyPointFixtures,
      }),
    ).toEqual({
      kind: 'aggregated',
      bucketStartDate: '2026-08-03',
      bucketEndDate: '2026-08-09',
      value: 75,
      loggingCounts: { complete: 2, partial: 1, inProgress: 0, unlogged: 1 },
      metricCounts: { recorded: 1, partial: 1, unknown: 1 },
      numericDayCount: 2,
    });
  });
});
