import type {
  AnalyticsOverviewEnergy,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
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
}: {
  overview: AnalyticsReportOverviewState<'energy'> | undefined;
  trend: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
}) {
  const { width } = useWindowDimensions();
  const data = overview?.data ?? null;
  return (
    <View testID="simple-insights-section-energy-balance" className="gap-3">
      <ReportingSectionHeading icon="energy" title="Energy balance" />
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
          <AppCard elevated className="gap-3 p-[18px]">
            <AppText variant="caption" className="text-muted">
              REPORT · Daily average
            </AppText>
            <AppText variant="display" className="text-[38px] leading-[42px]">
              {energyLabel(data.average)}
            </AppText>
            <AppText variant="caption" className="text-primary-dark">
              {statusCopy(data)}
            </AppText>
            <View className="rounded-[12px] bg-module p-2">
              {trend?.data === null || trend?.data === undefined ? (
                <AppText variant="caption" className="text-muted">
                  Trend preview unavailable
                </AppText>
              ) : (
                <LineTrendChart
                  data={trendData(trend)}
                  width={Math.max(220, width - 76)}
                  height={72}
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
