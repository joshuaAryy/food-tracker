import {
  type AnalyticsAggregatedPoint,
  type AnalyticsDailyPoint,
} from '@food-tracker/shared';

export interface AggregateAnalyticsBucketInput {
  bucketStartDate: string;
  bucketEndDate: string;
  points: readonly AnalyticsDailyPoint[];
}

/**
 * Buckets retain independent state counts. A mixed bucket deliberately has no
 * synthetic single logging or metric state.
 */
export function aggregateAnalyticsBucket({
  bucketStartDate,
  bucketEndDate,
  points,
}: AggregateAnalyticsBucketInput): AnalyticsAggregatedPoint {
  const loggingCounts = { complete: 0, partial: 0, inProgress: 0, unlogged: 0 };
  const metricCounts = { recorded: 0, partial: 0, unknown: 0 };
  const numericValues: number[] = [];

  for (const point of points) {
    if (point.loggingDayPhase === 'in_progress') {
      loggingCounts.inProgress += 1;
    } else {
      loggingCounts[point.loggingDayState] += 1;
    }

    if (point.metricDataState !== null) {
      metricCounts[point.metricDataState] += 1;
    }
    if (
      point.value !== null &&
      (point.metricDataState === 'recorded' ||
        point.metricDataState === 'partial')
    ) {
      numericValues.push(point.value);
    }
  }

  const numericDayCount = numericValues.length;
  return {
    kind: 'aggregated',
    bucketStartDate,
    bucketEndDate,
    value:
      numericDayCount === 0
        ? null
        : numericValues.reduce((sum, value) => sum + value, 0) /
          numericDayCount,
    loggingCounts,
    metricCounts,
    numericDayCount,
  };
}

function weeklyBucketKey(date: string): string {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const offsetFromMonday = (weekday + 6) % 7;
  const monday = new Date(`${date}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() - offsetFromMonday);
  return monday.toISOString().slice(0, 10);
}

function bucketKey(date: string, aggregation: 'weekly' | 'monthly'): string {
  return aggregation === 'weekly' ? weeklyBucketKey(date) : date.slice(0, 7);
}

export function aggregateAnalyticsPoints(
  points: readonly AnalyticsDailyPoint[],
  aggregation: 'weekly' | 'monthly',
): AnalyticsAggregatedPoint[] {
  const buckets = new Map<string, AnalyticsDailyPoint[]>();
  for (const point of points) {
    const key = bucketKey(point.date, aggregation);
    buckets.set(key, [...(buckets.get(key) ?? []), point]);
  }

  return [...buckets.values()].map((bucketPoints) =>
    aggregateAnalyticsBucket({
      bucketStartDate: bucketPoints[0]?.date ?? '',
      bucketEndDate: bucketPoints.at(-1)?.date ?? '',
      points: bucketPoints,
    }),
  );
}
