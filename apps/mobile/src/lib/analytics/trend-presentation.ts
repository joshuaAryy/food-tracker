import type {
  AnalyticsAggregation,
  AnalyticsMetricKey,
} from '@food-tracker/shared';

export type CoreTrendPresentation =
  | 'bars_with_trend'
  | 'weight_line'
  | 'macro'
  | 'logging_heatmap'
  | 'line';

export function coreTrendPresentation(
  metric: AnalyticsMetricKey,
  aggregation: Exclude<AnalyticsAggregation, 'automatic'>,
): CoreTrendPresentation {
  if (metric === 'macroComposition') return 'macro';
  if (metric === 'weight') return 'weight_line';
  if (metric === 'loggingConsistency') {
    return aggregation === 'daily' ? 'logging_heatmap' : 'bars_with_trend';
  }
  if (metric === 'calories' || metric === 'hydration') {
    return 'bars_with_trend';
  }
  return 'line';
}
