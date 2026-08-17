import type {
  AnalyticsContributorsResponse,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BarTrendChart } from '@/components/analytics/charts/bar-trend-chart';
import { TrendContributorsCard } from '@/components/analytics/trends/trend-contributors-card';
import {
  formatPresentationDate,
  formatPresentationDateRange,
} from '@/lib/date-time';
import { formatMetricValue, formatMetricWithUnit } from '@/lib/reporting-ui';
import { RelatedMetricCard } from './related-metric-card';

function rangeLabel(trend: CanonicalTrendResponse): string {
  if (trend.reference.kind !== 'range') return 'Reference unavailable';
  return `${formatMetricValue(trend.reference.lower)}–${formatMetricValue(trend.reference.upper)} ${trend.reference.unit}`;
}

function averageStatus(trend: CanonicalTrendResponse): string {
  if (trend.interpretation?.kind === 'within_range') {
    return 'average · inside your range';
  }
  if (
    trend.interpretation?.kind === 'below_range' ||
    trend.interpretation?.kind === 'above_range'
  ) {
    return 'average · outside your range';
  }
  return 'average · reference unavailable';
}

export function VitaminCDetailReport({
  trend,
  relatedTrend,
  relatedError,
  relatedName,
  contributors,
  width,
  onOpenRelated,
  onOpenContributors,
}: {
  trend: CanonicalTrendResponse;
  relatedTrend: CanonicalTrendResponse | null;
  relatedError: string | null;
  relatedName: string;
  contributors: AnalyticsContributorsResponse | null;
  width: number;
  onOpenRelated: () => void;
  onOpenContributors: () => void;
}) {
  const points = trend.points.map((point) => ({
    date: point.kind === 'daily' ? point.date : point.bucketStartDate,
    value: point.value,
  }));
  const recordedDays = trend.metricDataSummary?.recorded ?? 0;
  const latestRecordedPoint = [...trend.points]
    .reverse()
    .find((point) => point.value !== null);
  const latestRecordedIndex =
    latestRecordedPoint === undefined
      ? null
      : trend.points.findIndex((point) => point === latestRecordedPoint);
  return (
    <View testID="vitamin-c-detail-report" className="gap-4">
      <View className="gap-1">
        <View className="flex-row items-end justify-between gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="display" className="text-[38px] leading-[42px]">
              {formatMetricWithUnit(
                trend.summary.average,
                trend.reference.unit,
              )}
            </AppText>
            <AppText variant="caption" className="text-muted">
              {averageStatus(trend)}
            </AppText>
          </View>
          <View className="items-end gap-1">
            <AppText variant="caption" className="text-muted">
              {trend.reference.kind === 'range' &&
              trend.reference.source === 'user'
                ? 'Custom range'
                : 'Configured range'}
            </AppText>
            <AppText variant="label">{rangeLabel(trend)}</AppText>
          </View>
        </View>
      </View>
      <AppCard
        testID="vitamin-c-chart-card"
        elevated
        className="gap-3 p-[18px]"
      >
        <AppText variant="caption" className="font-bold uppercase text-muted">
          {formatPresentationDateRange(
            trend.resolvedRange.startDate,
            trend.resolvedRange.endDate,
          )}{' '}
          · {trend.reference.unit}
        </AppText>
        <View testID="vitamin-c-bar-trend">
          <BarTrendChart
            data={points}
            width={Math.max(196, width - 118)}
            height={190}
            color="#5867C7"
            barFill="#D8DCE3"
            selectedBarFill="#5867C7"
            showGrid
            trendValues={trend.rollingTrend?.values}
            initialSelectedIndex={latestRecordedIndex}
            showSelectionTooltip={false}
            showSelectionDescription={false}
            referenceRange={
              trend.reference.kind === 'range'
                ? {
                    lower: trend.reference.lower,
                    upper: trend.reference.upper,
                  }
                : null
            }
            accessibilityLabel={`Vitamin C trend for ${formatPresentationDateRange(trend.resolvedRange.startDate, trend.resolvedRange.endDate)}`}
          />
        </View>
        {latestRecordedPoint === undefined ? null : (
          <View className="flex-row justify-between border-t border-border pt-3">
            <AppText variant="label">
              {formatPresentationDate(
                latestRecordedPoint.kind === 'daily'
                  ? latestRecordedPoint.date
                  : latestRecordedPoint.bucketStartDate,
              )}
            </AppText>
            <AppText variant="caption" className="text-muted">
              {formatMetricWithUnit(
                latestRecordedPoint.value,
                trend.reference.unit,
              )}{' '}
              · Recorded metric
            </AppText>
          </View>
        )}
        <AppText variant="caption" className="text-muted">
          {recordedDays} recorded days are available for this configured range.
          Unknown nutrient values remain gaps.
        </AppText>
      </AppCard>
      <RelatedMetricCard
        name={relatedName}
        trend={relatedTrend}
        error={relatedError}
        onOpen={onOpenRelated}
      />
      <TrendContributorsCard
        contributors={contributors?.contributors ?? []}
        onOpenAll={onOpenContributors}
      />
    </View>
  );
}
