import {
  analyticsMetricForKey,
  analyticsMetricKeySchema,
  type AnalyticsSavedViewConfiguration,
} from '@food-tracker/shared';
import { AppError } from '../../../lib/errors.js';
import { resolveComparisonStrategy } from '../trends/comparisons.js';

/** Validates only current configurations; historical unknown metric strings stay readable. */
export function validateSavedViewConfiguration(
  configuration: AnalyticsSavedViewConfiguration,
): void {
  const primary = analyticsMetricKeySchema.safeParse(configuration.primaryMetric);
  if (!primary.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Primary metric is unavailable');
  }
  const primaryDefinition = analyticsMetricForKey(primary.data);
  if (
    !primaryDefinition.supportedAggregations.includes(configuration.aggregation) ||
    !primaryDefinition.supportedCoverageFilters.includes(configuration.coverageFilter)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'The selected metric does not support this saved-view configuration',
    );
  }
  if (configuration.comparisonMetric === undefined || configuration.comparisonMetric === null) {
    if (!primaryDefinition.supportedVisualizations.includes(configuration.visualization)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Visualization is unsupported for the selected metric');
    }
    return;
  }
  if (configuration.comparisonMetric === primary.data) {
    throw new AppError(400, 'VALIDATION_ERROR', 'A saved view cannot compare a metric with itself');
  }
  const comparison = analyticsMetricKeySchema.safeParse(configuration.comparisonMetric);
  if (!comparison.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Comparison metric is unavailable');
  }
  const strategy = resolveComparisonStrategy(primary.data, comparison.data);
  if (strategy === 'incompatible') {
    throw new AppError(400, 'VALIDATION_ERROR', 'These metrics do not support comparison');
  }
  const expectedVisualization =
    strategy === 'dual_axis'
      ? 'dual_axis'
      : strategy === 'reference_normalized'
        ? 'reference_normalized'
        : 'linked_trends';
  if (
    configuration.visualization !== 'automatic' &&
    configuration.visualization !== expectedVisualization
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Visualization is incompatible with the comparison strategy');
  }
}
