import type { AnalyticsComparisonStrategy } from '@food-tracker/shared';
import type { ChartDomain } from './chart-domain';

export function chartDomainFromAxis(axis: {
  minimum: number;
  maximum: number;
}): ChartDomain {
  return { min: axis.minimum, max: axis.maximum };
}

export function comparisonValues(
  points: readonly { value: number | null; normalizedValue?: number }[],
  strategy: AnalyticsComparisonStrategy,
): (number | null)[] {
  return points.map((point) =>
    strategy === 'reference_normalized'
      ? (point.normalizedValue ?? null)
      : point.value,
  );
}
