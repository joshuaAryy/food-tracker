import type { AnalyticsOverviewWeight } from '@food-tracker/shared';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import { formatMetricWithUnit } from '@/lib/reporting-ui';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function changeCopy(change: AnalyticsOverviewWeight['change']): string {
  if (change.value === null || change.direction === 'unknown')
    return 'No 30-day change yet';
  const sign = change.value > 0 ? '+' : '';
  return `${sign}${formatMetricWithUnit(change.value, 'lb')} over ${change.periodDays} days`;
}

function goalCopy(status: AnalyticsOverviewWeight['goalPathStatus']): string {
  switch (status) {
    case 'moving_toward':
      return 'Moving toward goal';
    case 'moving_away':
      return 'Moving away from goal';
    case 'at_goal':
      return 'At goal';
    case 'no_goal':
      return 'No weight goal configured';
    default:
      return 'Goal direction unavailable';
  }
}

export function WeightDirectionCard({
  overview,
  trend,
  onOpenTrend,
  onRetry,
  compact = false,
}: {
  overview: AnalyticsReportOverviewState<'weight'> | undefined;
  trend: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
  compact?: boolean;
}) {
  const { width } = useWindowDimensions();
  const data = overview?.data ?? null;
  const chartData =
    trend?.data?.points.map((point) => ({
      date: point.kind === 'daily' ? point.date : point.bucketStartDate,
      value: point.value,
    })) ?? [];
  return (
    <View
      testID="simple-insights-section-weight-direction"
      className={compact ? 'gap-2' : 'gap-3'}
    >
      <ReportingSectionHeading
        icon="weight"
        title="Weight direction"
        compact={compact}
      />
      {data === null ? (
        <AnalyticsSectionError
          title="Weight"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Weight trend"
          onPress={onOpenTrend}
        >
          <AppCard
            elevated
            compact={compact}
            className={compact ? 'gap-2 rounded-[12px] p-3' : 'gap-3 p-[18px]'}
          >
            <AppText variant="caption" className="text-muted">
              REPORT · Current weight
            </AppText>
            <View className="flex-row items-end justify-between gap-3">
              <AppText
                variant="number"
                className={
                  compact ? 'text-[24px] leading-7' : 'text-[30px] leading-9'
                }
              >
                {formatMetricWithUnit(data.current, 'lb')}
              </AppText>
              <AppText variant="caption" className="text-primary-dark">
                {changeCopy(data.change)}
              </AppText>
            </View>
            <View className="rounded-[10px] bg-module-muted p-1.5">
              {chartData.length === 0 ? (
                <AppText variant="caption" className="text-muted">
                  Weight trend unavailable
                </AppText>
              ) : (
                <LineTrendChart
                  data={chartData}
                  width={Math.max(220, width - 76)}
                  height={44}
                  color="#7A9B76"
                  trendValues={trend?.data?.rollingTrend?.values}
                  reference={
                    data.reference.kind === 'target'
                      ? data.reference.value
                      : null
                  }
                  accessibilityLabel="Weight direction trend"
                />
              )}
            </View>
            <View className="flex-row items-center justify-between gap-3">
              <AppText variant="caption" className="text-muted">
                {goalCopy(data.goalPathStatus)}
              </AppText>
              {data.forecast.status === 'available' ? (
                <AppText variant="caption" className="text-muted">
                  {data.forecast.data.horizonDays}d projection available
                </AppText>
              ) : (
                <AppText variant="caption" className="text-muted">
                  Forecast unavailable
                </AppText>
              )}
            </View>
          </AppCard>
        </Pressable>
      )}
    </View>
  );
}
