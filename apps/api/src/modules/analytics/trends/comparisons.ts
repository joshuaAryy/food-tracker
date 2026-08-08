import type { AnalyticsMetricKey } from '@food-tracker/shared';

export type ComparisonStrategy =
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

/**
 * Comparisons are deliberately allowlisted: unlike units alone never imply a
 * normalized comparison, and only approved pairs receive two axes.
 */
export function resolveComparisonStrategy(
  primary: AnalyticsMetricKey,
  comparison: AnalyticsMetricKey,
): ComparisonStrategy {
  if (isPair(primary, comparison, 'protein', 'carbs')) return 'shared_unit';
  if (isPair(primary, comparison, 'protein', 'weight')) return 'dual_axis';
  if (isPair(primary, comparison, 'sodium', 'potassium')) {
    return 'reference_normalized';
  }
  return 'incompatible';
}
