import type { AnalyticsOverviewEnergy } from '@food-tracker/shared';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function energyLabel(value: number | null): string {
  return value === null
    ? '—'
    : `${Math.round(value).toLocaleString('en-US')} kcal`;
}

function statusCopy(data: AnalyticsOverviewEnergy): string {
  if (data.status === 'within_range') {
    return `Within range on ${data.withinRangeDayCount} logged days`;
  }
  if (data.status === 'below_range') return 'Below the configured range';
  if (data.status === 'above_range') return 'Above the configured range';
  if (data.status === 'no_reference') return 'No daily range configured';
  return 'Energy data is unavailable';
}

function referenceCopy(data: AnalyticsOverviewEnergy): string {
  if (data.reference.kind === 'none') return 'Target unavailable';
  return `${Math.round(data.reference.lower).toLocaleString('en-US')}–${Math.round(data.reference.upper).toLocaleString('en-US')} kcal`;
}

function statusColor(data: AnalyticsOverviewEnergy): string {
  if (data.status === 'below_range' || data.status === 'above_range') {
    return '#C9242D';
  }
  if (data.status === 'unknown' || data.status === 'no_reference') {
    return '#6D7C6B';
  }
  return '#00B86B';
}

function trendData(section: AnalyticsReportSectionState | undefined) {
  return (
    section?.data?.points.map((point) => ({
      date: point.kind === 'daily' ? point.date : point.bucketStartDate,
      value: point.value,
    })) ?? []
  );
}

export function EnergyBalanceCard({
  overview,
  trend,
  onOpenTrend,
  onRetry,
  compact = false,
}: {
  overview: AnalyticsReportOverviewState<'energy'> | undefined;
  trend: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
  compact?: boolean;
}) {
  const { width } = useWindowDimensions();
  const data = overview?.data ?? null;
  return (
    <View
      testID="simple-insights-section-energy-balance"
      className={compact ? 'gap-2' : 'gap-3'}
    >
      <ReportingSectionHeading
        icon="energy"
        title="Energy balance"
        compact={compact}
      />
      {data === null ? (
        <AnalyticsSectionError
          title="Energy balance"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <Pressable
          accessibilityLabel="Open Calories trend"
          accessibilityRole="button"
          onPress={onOpenTrend}
        >
          <AppCard
            elevated
            compact={compact}
            className={compact ? 'gap-2 rounded-[12px] p-3' : 'gap-3 p-[18px]'}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="gap-1">
                <AppText variant="caption" className="text-muted">
                  REPORT · Daily average
                </AppText>
                <AppText
                  variant="display"
                  className={
                    compact
                      ? 'text-[25px] leading-7'
                      : 'text-[38px] leading-[42px]'
                  }
                >
                  {energyLabel(data.average)}
                </AppText>
              </View>
              <View className="items-end gap-1 pt-1">
                <AppText variant="caption" className="text-muted">
                  Daily target
                </AppText>
                <AppText variant="caption" className="text-ink">
                  {referenceCopy(data)}
                </AppText>
              </View>
            </View>
            <AppText variant="caption" style={{ color: statusColor(data) }}>
              {statusCopy(data)}
            </AppText>
            <View className="gap-1 rounded-[10px] bg-module-muted p-1.5">
              {trend?.data === null || trend?.data === undefined ? (
                <AppText variant="caption" className="text-muted">
                  Trend preview unavailable
                </AppText>
              ) : (
                <LineTrendChart
                  data={trendData(trend)}
                  width={Math.max(220, width - 76)}
                  height={compact ? 48 : 72}
                  color="#33B866"
                  referenceRange={
                    data.reference.kind === 'range'
                      ? {
                          lower: data.reference.lower,
                          upper: data.reference.upper,
                        }
                      : null
                  }
                  accessibilityLabel="Energy balance trend"
                />
              )}
              <View className="flex-row items-center justify-between">
                <AppText variant="caption" className="text-muted">
                  kcal
                </AppText>
                <AppText variant="caption" className="text-muted">
                  14D
                </AppText>
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <AppText variant="caption" className="text-muted">
                TREND · 14 days
              </AppText>
              <AppText variant="caption" className="text-ink">
                {data.comparison.percentage === null
                  ? 'No previous period'
                  : `${data.comparison.percentage > 0 ? '+' : ''}${data.comparison.percentage}% vs previous period`}
              </AppText>
            </View>
          </AppCard>
        </Pressable>
      )}
    </View>
  );
}
