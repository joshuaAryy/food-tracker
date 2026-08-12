import { View } from 'react-native';
import type {
  AnalyticsComparisonStrategy,
  AnalyticsMetricKey,
} from '@food-tracker/shared';
import { analyticsMetricForKey } from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import {
  ComparisonChart,
  type ComparisonChartDatum,
} from '@/components/analytics/charts/comparison-chart';
function strategySubtitle(strategy: AnalyticsComparisonStrategy): string {
  switch (strategy) {
    case 'shared_unit':
      return 'Shared raw scale · grams per day';
    case 'dual_axis':
      return 'Dual-axis overlay · shared timeline';
    case 'reference_normalized':
      return 'Normalized to each metric’s own reference';
    default:
      return 'Comparison unavailable for this metric pair.';
  }
}

function strategyReading(strategy: AnalyticsComparisonStrategy): string {
  switch (strategy) {
    case 'shared_unit':
      return 'Both metrics use the same unit, so the chart keeps the real values instead of normalizing them.';
    case 'dual_axis':
      return 'Each metric keeps its own raw scale while one timeline and scrub position return both values for the same date.';
    case 'reference_normalized':
      return 'Each line is converted to percent of its authoritative target or limit for comparison; selected-date values remain in their original units.';
    default:
      return 'Comparison unavailable';
  }
}

export function ComparisonTrendReport({
  primaryMetric,
  comparisonMetric,
  strategy,
  primary,
  comparison,
  primaryAxis,
  comparisonAxis,
  primaryAverage,
  width,
}: {
  primaryMetric: AnalyticsMetricKey;
  comparisonMetric: AnalyticsMetricKey;
  strategy: Exclude<AnalyticsComparisonStrategy, 'incompatible'>;
  primary: readonly ComparisonChartDatum[];
  comparison: readonly ComparisonChartDatum[];
  primaryAxis: { minimum: number; maximum: number };
  comparisonAxis: { minimum: number; maximum: number };
  primaryAverage: number | null;
  width: number;
}) {
  const primaryDefinition = analyticsMetricForKey(primaryMetric);
  const comparisonDefinition = analyticsMetricForKey(comparisonMetric);
  const chartWidth = Math.max(280, width - 40);
  const primaryAxisLabel =
    strategy === 'reference_normalized'
      ? '% of own target / limit'
      : `${primaryDefinition.displayName} · ${primaryDefinition.unit}`;
  const comparisonAxisLabel =
    strategy === 'reference_normalized'
      ? '% of own target / limit'
      : `${comparisonDefinition.displayName} · ${comparisonDefinition.unit}`;
  return (
    <View testID="comparison-trend-report" className="gap-4">
      <View className="gap-1">
        <AppText variant="heading" className="text-[26px] leading-8">
          {primaryDefinition.displayName} + {comparisonDefinition.displayName}
        </AppText>
        <AppText muted>{strategySubtitle(strategy)}</AppText>
      </View>
      <AppCard className="gap-3 p-[18px]">
        <View className="gap-1">
          <AppText variant="label">{strategySubtitle(strategy)}</AppText>
        </View>
        <View className="flex-row flex-wrap gap-3">
          <AppText variant="caption">
            ● {primaryDefinition.displayName} · {primaryDefinition.unit}
          </AppText>
          <AppText variant="caption" className="text-[#7A9B76]">
            ● {comparisonDefinition.displayName} · {comparisonDefinition.unit}
          </AppText>
        </View>
        <ComparisonChart
          primary={primary}
          comparison={comparison}
          strategy={strategy}
          primaryAxis={primaryAxis}
          comparisonAxis={comparisonAxis}
          primaryAxisLabel={primaryAxisLabel}
          comparisonAxisLabel={comparisonAxisLabel}
          width={chartWidth}
          accessibilityLabel={`${primaryDefinition.displayName} and ${comparisonDefinition.displayName} comparison`}
        />
      </AppCard>
      <AppCard className="gap-2 bg-module p-4">
        <AppText variant="label">Comparison reading</AppText>
        <AppText variant="body">{strategyReading(strategy)}</AppText>
        {primaryAverage === null ? (
          <AppText variant="caption" className="text-muted">
            No recorded primary average is available for this period.
          </AppText>
        ) : null}
      </AppCard>
    </View>
  );
}
