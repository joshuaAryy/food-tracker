import type {
  AnalyticsMetricKey,
  AnalyticsReference,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { AppCard } from '@/components/app-card';
import {
  ComparisonChart,
  type ComparisonChartDatum,
} from '@/components/analytics/charts/comparison-chart';
import { NutrientReferenceSummary } from './nutrient-reference-summary';
import { RelatedMetricCard } from './related-metric-card';

export function NutrientPairReport({
  primaryName,
  primaryReference,
  relatedName,
  relatedMetric,
  relatedTrend,
  comparisonTrend,
  relatedError,
  onOpenRelated,
}: {
  primaryName: string;
  primaryReference: AnalyticsReference;
  relatedName: string;
  relatedMetric: AnalyticsMetricKey;
  relatedTrend: CanonicalTrendResponse | null;
  comparisonTrend: CanonicalTrendResponse | null;
  relatedError: string | null;
  onOpenRelated: (metric: AnalyticsMetricKey) => void;
}) {
  const normalizedComparison =
    comparisonTrend?.comparison?.strategy === 'reference_normalized'
      ? comparisonTrend.comparison
      : null;
  const normalizedPrimaryPoints: ComparisonChartDatum[] =
    normalizedComparison === null || comparisonTrend === null
      ? []
      : comparisonTrend.points.map((point) => ({
          date: point.kind === 'daily' ? point.date : point.bucketStartDate,
          value: point.value,
          ...(point.normalizedValue === undefined
            ? {}
            : { normalizedValue: point.normalizedValue }),
        }));
  const normalizedRelatedPoints: ComparisonChartDatum[] =
    normalizedComparison === null
      ? []
      : normalizedComparison.points.map((point) => ({
          date: point.kind === 'daily' ? point.date : point.bucketStartDate,
          value: point.value,
          ...(point.normalizedValue === undefined
            ? {}
            : { normalizedValue: point.normalizedValue }),
        }));
  return (
    <View className="gap-3">
      <View className="gap-1">
        <AppText variant="label">Related metric</AppText>
        <AppText variant="heading" className="text-[20px] leading-7">
          {primaryName}
        </AppText>
        <AppText variant="caption" className="text-muted">
          The primary nutrient retains its own authoritative reference while the
          paired metric provides context.
        </AppText>
        <NutrientReferenceSummary reference={primaryReference} />
      </View>
      {normalizedComparison === null ||
      normalizedComparison.primaryAxisDomain === null ||
      normalizedComparison.comparisonAxisDomain === null ? null : (
        <AppCard className="gap-3 p-4">
          <View className="gap-1">
            <AppText variant="label">Normalized paired trend</AppText>
            <AppText variant="caption" className="text-muted">
              % of own target / limit · raw selected-date units remain available
            </AppText>
          </View>
          <View className="flex-row flex-wrap gap-3">
            <AppText variant="caption">● {primaryName}</AppText>
            <AppText variant="caption" className="text-[#408C85]">
              ● {relatedName}
            </AppText>
          </View>
          <ComparisonChart
            primary={normalizedPrimaryPoints}
            comparison={normalizedRelatedPoints}
            strategy="reference_normalized"
            primaryAxis={normalizedComparison.primaryAxisDomain}
            comparisonAxis={normalizedComparison.comparisonAxisDomain}
            primaryAxisLabel="% of own target / limit"
            comparisonAxisLabel="% of own target / limit"
            width={320}
            accessibilityLabel={`${primaryName} and ${relatedName} normalized comparison`}
          />
        </AppCard>
      )}
      <RelatedMetricCard
        name={relatedName}
        trend={relatedTrend}
        error={relatedError}
        onOpen={() => onOpenRelated(relatedMetric)}
      />
    </View>
  );
}
