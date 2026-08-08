import { describe, expect, it } from 'vitest';
import { aggregateAnalyticsBucket } from '../src/modules/analytics/trends/aggregation.js';

describe('analytics aggregation', () => {
  it('keeps weekly bucket states as independent counts and excludes gaps from the average', () => {
    expect(
      aggregateAnalyticsBucket({
        bucketStartDate: '2026-08-03',
        bucketEndDate: '2026-08-09',
        points: [
          {
            kind: 'daily',
            date: '2026-08-03',
            loggingDayState: 'complete',
            loggingDayPhase: 'closed',
            metricDataState: 'recorded',
            value: 100,
            foodLogCount: 3,
            metricRecordedLogCount: 3,
            metricUnknownLogCount: 0,
          },
          {
            kind: 'daily',
            date: '2026-08-04',
            loggingDayState: 'complete',
            loggingDayPhase: 'closed',
            metricDataState: 'unknown',
            value: null,
            foodLogCount: 3,
            metricRecordedLogCount: 0,
            metricUnknownLogCount: 3,
          },
          {
            kind: 'daily',
            date: '2026-08-05',
            loggingDayState: 'partial',
            loggingDayPhase: 'closed',
            metricDataState: 'partial',
            value: 50,
            foodLogCount: 2,
            metricRecordedLogCount: 1,
            metricUnknownLogCount: 1,
          },
          {
            kind: 'daily',
            date: '2026-08-06',
            loggingDayState: 'unlogged',
            loggingDayPhase: 'closed',
            metricDataState: null,
            value: null,
            foodLogCount: 0,
            metricRecordedLogCount: 0,
            metricUnknownLogCount: 0,
          },
        ],
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
