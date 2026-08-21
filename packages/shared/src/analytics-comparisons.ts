import type { AnalyticsMetricKey } from './analytics-metrics.js';
import { analyticsMetricForKey } from './analytics-metrics.js';

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

/**
 * Resolve the presentation relationship without making unit compatibility a
 * mobile concern. Complex Explore exposes every supported metric pair except
 * the composition-only metric; the report keeps separate raw axes when units
 * differ and reserves normalization for the explicitly related sodium pair.
 */
export function resolveAnalyticsComparisonStrategy(
  primary: AnalyticsMetricKey,
  comparison: AnalyticsMetricKey,
): AnalyticsComparisonStrategy {
  if (primary === comparison) return 'incompatible';
  if (primary === 'macroComposition' || comparison === 'macroComposition') {
    return 'incompatible';
  }
  if (isPair(primary, comparison, 'protein', 'carbs')) return 'shared_unit';
  if (isPair(primary, comparison, 'protein', 'weight')) return 'dual_axis';
  if (isPair(primary, comparison, 'sodium', 'potassium')) {
    return 'reference_normalized';
  }
  return analyticsMetricForKey(primary).unit ===
    analyticsMetricForKey(comparison).unit
    ? 'shared_unit'
    : 'dual_axis';
}
