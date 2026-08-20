import type {
  AnalyticsContributorsResponse,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BarTrendChart } from '@/components/analytics/charts/bar-trend-chart';
import { TrendContributorsCard } from '@/components/analytics/trends/trend-contributors-card';
import { TrendPeriodPills } from '@/components/analytics/trends/trend-period-pills';
import {
  formatPresentationDate,
  formatPresentationDateRange,
} from '@/lib/date-time';
import { formatMetricValue, formatMetricWithUnit } from '@/lib/reporting-ui';
import { axisReferenceLabel } from '@/lib/analytics/chart-axis';
import { RelatedMetricCard } from './related-metric-card';

const VITAMIN_C_ACCENT = '#5766C7';

function rangeLabel(trend: CanonicalTrendResponse): string {
  if (trend.reference.kind === 'range') {
    return `${formatMetricValue(trend.reference.lower)}–${formatMetricValue(trend.reference.upper)} ${trend.reference.unit}`;
  }
  return axisReferenceLabel(trend.reference) ?? 'Reference unavailable';
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
  if (trend.interpretation?.kind === 'below_minimum') {
    return 'average · below your minimum';
  }
  if (trend.interpretation?.kind === 'meets_minimum') {
    return 'average · meets your minimum';
  }
  if (trend.interpretation?.kind === 'above_limit') {
    return 'average · above your limit';
  }
  if (trend.interpretation?.kind === 'within_limit') {
    return 'average · within your limit';
  }
  return 'average · reference unavailable';
}

function recordedPeriodSummary(
  trend: CanonicalTrendResponse,
  recordedDays: number,
): string {
  const dayLabel = `recorded day${recordedDays === 1 ? '' : 's'}`;
  if (recordedDays === 0 || trend.summary.average === null) {
    return 'No recorded values are available for this period.';
  }
  if (trend.interpretation?.kind === 'within_range') {
    return `Average across ${recordedDays} ${dayLabel} is inside your configured range.`;
  }
  if (
    trend.interpretation?.kind === 'below_range' ||
    trend.interpretation?.kind === 'above_range'
  ) {
    return `Average across ${recordedDays} ${dayLabel} is outside your configured range.`;
  }
  if (trend.interpretation?.kind === 'below_minimum') {
    return `Average across ${recordedDays} ${dayLabel} is below your configured minimum.`;
  }
  if (trend.interpretation?.kind === 'meets_minimum') {
    return `Average across ${recordedDays} ${dayLabel} meets your configured minimum.`;
  }
  if (trend.interpretation?.kind === 'above_limit') {
    return `Average across ${recordedDays} ${dayLabel} is above your configured limit.`;
  }
  if (trend.interpretation?.kind === 'within_limit') {
    return `Average across ${recordedDays} ${dayLabel} is within your configured limit.`;
  }
  return `${recordedDays} ${dayLabel} are available. Reference unavailable.`;
}

function observationStateLabel(
  point: CanonicalTrendResponse['points'][number],
): string {
  if (point.kind !== 'daily') return 'Recorded period';

  const metricState =
    point.metricDataState === 'partial' ? 'Partial metric' : 'Recorded metric';
  const loggingState =
    point.loggingDayPhase === 'in_progress'
      ? 'In progress'
      : point.loggingDayState === 'complete'
        ? 'Complete day'
        : point.loggingDayState === 'partial'
          ? 'Partial day'
          : 'Unlogged day';

  return `${metricState} · ${loggingState}`;
}

export function VitaminCDetailReport({
  trend,
  relatedTrend,
  relatedError,
  relatedName,
  contributors,
  width,
  simple,
  selectedPeriod,
  onSelectPeriod,
  onOpenCustomRange,
  onOpenRelated,
  onOpenContributors,
}: {
  trend: CanonicalTrendResponse;
  relatedTrend: CanonicalTrendResponse | null;
  relatedError: string | null;
  relatedName: string;
  contributors: AnalyticsContributorsResponse | null;
  width: number;
  simple: boolean;
  selectedPeriod: 7 | 30 | 90 | null;
  onSelectPeriod: (period: 7 | 30 | 90) => void;
  onOpenCustomRange: () => void;
  onOpenRelated: () => void;
  onOpenContributors: () => void;
}) {
  const points = trend.points.map((point) => ({
    date: point.kind === 'daily' ? point.date : point.bucketStartDate,
    value: point.value,
  }));
  const recordedDays = trend.summary.numericDayCount;
  const latestRecordedPoint = [...trend.points]
    .reverse()
    .find((point) => point.value !== null);
  const latestRecordedIndex =
    latestRecordedPoint === undefined
      ? null
      : trend.points.findIndex((point) => point === latestRecordedPoint);
  return (
    <View testID="vitamin-c-detail-report" className="gap-5">
      <View className="gap-1">
        <View className="flex-row items-end justify-between gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="display" className="text-[32px] leading-[36px]">
              {formatMetricWithUnit(
                trend.summary.average,
                trend.reference.unit,
              )}
            </AppText>
            <AppText variant="caption" style={{ color: VITAMIN_C_ACCENT }}>
              {averageStatus(trend)}
            </AppText>
          </View>
          <View className="items-end gap-1">
            <AppText variant="caption" className="text-muted">
              {trend.reference.kind === 'range'
                ? trend.reference.source === 'user'
                  ? 'Custom range'
                  : 'Configured range'
                : 'Reference'}
            </AppText>
            <AppText variant="label">{rangeLabel(trend)}</AppText>
          </View>
        </View>
      </View>
      <TrendPeriodPills
        selectedPeriod={selectedPeriod}
        onSelect={onSelectPeriod}
        simple={simple}
        onOpenCustomRange={onOpenCustomRange}
      />
      <AppCard
        testID="vitamin-c-chart-card"
        elevated
        className="gap-3 p-[18px]"
        style={{ minHeight: 372 }}
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
            width={Math.max(280, width - 40)}
            height={190}
            color={VITAMIN_C_ACCENT}
            barFill="#D2D7E1"
            barStroke="#C4CBD7"
            selectedBarFill="#858A99"
            selectedBarStroke="#858A99"
            showGrid
            gridOpacity={0.45}
            trendValues={trend.rollingTrend?.values}
            reference={
              trend.reference.kind === 'range' ||
              trend.reference.kind === 'none'
                ? null
                : trend.reference.value
            }
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
            showAxes
            periodDays={selectedPeriod ?? undefined}
            unit={trend.reference.unit}
            referenceLabel={axisReferenceLabel(trend.reference) ?? undefined}
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
              · {observationStateLabel(latestRecordedPoint)}
            </AppText>
          </View>
        )}
      </AppCard>
      <View testID="vitamin-c-recorded-period-summary" className="gap-2 pt-1">
        <AppText variant="label" className="text-[16px] leading-5">
          {recordedPeriodSummary(trend, recordedDays)}
        </AppText>
        <AppText variant="caption" className="text-muted">
          This describes the recorded period only; it does not infer a health
          outcome.
        </AppText>
      </View>
      <View className="mt-4 gap-3">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          Related metric
        </AppText>
        <RelatedMetricCard
          name={relatedName}
          trend={relatedTrend}
          error={relatedError}
          onOpen={onOpenRelated}
          presentation="nutrient-detail"
        />
      </View>
      <View className="mt-4 border-t border-border pt-7">
        <TrendContributorsCard
          contributors={contributors?.contributors ?? []}
          onOpenAll={onOpenContributors}
        />
      </View>
    </View>
  );
}
