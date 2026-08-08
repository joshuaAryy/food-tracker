import { type MetricDataState } from '@food-tracker/shared';

export interface MetricDataClassification {
  state: MetricDataState;
  recordedLogCount: number;
  unknownLogCount: number;
  value: number | null;
}

/**
 * Classifies selected-metric availability in authoritative FoodLog snapshots.
 * Numeric zero is recorded; a missing snapshot value is unknown.
 */
export function classifyMetricData(
  metricValues: readonly (number | null)[],
): MetricDataClassification {
  const recordedValues = metricValues.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  const recordedLogCount = recordedValues.length;
  const unknownLogCount = metricValues.length - recordedLogCount;
  const value =
    recordedLogCount === 0
      ? null
      : recordedValues.reduce((sum, metricValue) => sum + metricValue, 0);

  return {
    state:
      recordedLogCount === 0
        ? 'unknown'
        : unknownLogCount === 0
          ? 'recorded'
          : 'partial',
    recordedLogCount,
    unknownLogCount,
    value,
  };
}
