import type { AnalyticsMetricKey } from './analytics-metrics.js';

export type AnalyticsComparisonStrategy =
  | 'shared_unit'
  | 'dual_axis'
  | 'reference_normalized'
  | 'incompatible';

function isPair(
  left: AnalyticsMetricKey,
  right: AnalyticsMetricKey,
  first: AnalyticsMetricKey,
  second: AnalyticsMetricKey,
): boolean {
  return (
    (left === first && right === second) || (left === second && right === first)
  );
}

/** The approved comparison set; unlike units alone never implies compatibility. */
export function resolveAnalyticsComparisonStrategy(
  primary: AnalyticsMetricKey,
  comparison: AnalyticsMetricKey,
): AnalyticsComparisonStrategy {
  if (primary === comparison) return 'incompatible';
  if (isPair(primary, comparison, 'protein', 'carbs')) return 'shared_unit';
  if (isPair(primary, comparison, 'protein', 'weight')) return 'dual_axis';
  if (isPair(primary, comparison, 'sodium', 'potassium')) {
    return 'reference_normalized';
  }
  return 'incompatible';
}
