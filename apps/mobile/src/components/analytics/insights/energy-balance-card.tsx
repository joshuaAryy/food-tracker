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
import { chartStyleForMetric } from '@/lib/analytics/chart-style';
import { AnalyticsSectionError } from './analytics-section-error';
import { formatMetricWithUnit, formatMetricValue } from '@/lib/reporting-ui';

function energyLabel(value: number | null): string {
  return value === null
    ? '—'
    : formatMetricWithUnit(value, 'kcal', { maximumFractionDigits: 0 });
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
  return `${formatMetricValue(data.reference.lower, { maximumFractionDigits: 0 })}–${formatMetricValue(data.reference.upper, { maximumFractionDigits: 0 })} kcal`;
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

function trendPreview(section: AnalyticsReportSectionState | undefined) {
  if (section?.data === null || section?.data === undefined) return null;
  const data = trendData(section);
  const rollingValues = section.data.rollingTrend?.values;
  const hasRollingValues =
    rollingValues !== undefined &&
    rollingValues.length === data.length &&
    rollingValues.some((value) => value !== null && Number.isFinite(value));
  if (hasRollingValues) return { data, trendValues: rollingValues };
  if (
    data.some((point) => point.value !== null && Number.isFinite(point.value))
  ) {
    return { data, trendValues: undefined };
  }
  return null;
}

export function EnergyBalanceCard({
  overview,
  trend,
  onOpenTrend,
  onRetry,
  compact = false,
  presentation = 'simple',
  markerColor,
}: {
  overview: AnalyticsReportOverviewState<'energy'> | undefined;
  trend: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
  compact?: boolean;
  presentation?: 'simple' | 'complex';
  markerColor?: string;
}) {
  const { width } = useWindowDimensions();
  const data = overview?.data ?? null;
  const isComplexOverview = presentation === 'complex' && !compact;
  const preview = trendPreview(trend);
  return (
    <View
      testID="simple-insights-section-energy-balance"
      className={compact ? 'gap-2' : 'gap-3'}
    >
      <ReportingSectionHeading
        icon="energy"
        title="Energy balance"
        compact={compact}
        markerColor={markerColor}
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
            testID="energy-balance-card"
            className={
              compact
                ? 'gap-2 rounded-[12px] p-3'
                : isComplexOverview
                  ? 'gap-3 justify-between rounded-[20px] p-[18px]'
                  : 'gap-3 p-[18px]'
            }
            style={isComplexOverview ? { minHeight: 294 } : undefined}
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
            <View
              className={`gap-1 rounded-[10px] p-1.5 ${isComplexOverview ? 'bg-module' : 'bg-module-muted'}`}
            >
              {preview === null ? (
                <AppText variant="caption" className="text-muted">
                  Energy trend unavailable
                </AppText>
              ) : (
                <LineTrendChart
                  data={preview.data}
                  width={Math.max(220, width - 76)}
                  height={compact ? 48 : 72}
                  color="#0E0E0E"
                  chartStyle={chartStyleForMetric('calories')}
                  connectTrendGaps
                  trendValues={preview.trendValues}
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
                  14 days
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
                  : `${data.comparison.percentage > 0 ? '+' : ''}${formatMetricValue(data.comparison.percentage)}% vs previous period`}
              </AppText>
            </View>
          </AppCard>
        </Pressable>
      )}
    </View>
  );
}
