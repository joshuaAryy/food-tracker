import { useWindowDimensions, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportSectionState } from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function energyLabel(value: number | null): string {
  return value === null
    ? '—'
    : `${Math.round(value).toLocaleString('en-US')} kcal`;
}

export function EnergyBalanceCard({
  section,
  onOpenTrend,
  onRetry,
}: {
  section: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
}) {
  const { width } = useWindowDimensions();
  const data = section?.data ?? null;
  return (
    <View testID="simple-insights-section-energy-balance" className="gap-3">
      <ReportingSectionHeading icon="energy" title="Energy balance" />
      {data === null ? (
        <AnalyticsSectionError
          title="Energy balance"
          section={section}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="caption" className="text-muted">
            REPORT · Daily average
          </AppText>
          <AppText variant="display" className="text-[38px] leading-[42px]">
            {energyLabel(data.summary.average)}
          </AppText>
          <AppText variant="caption" className="text-primary-dark">
            {data.summary.numericDayCount} recorded days
          </AppText>
          <View className="rounded-[12px] bg-module p-2">
            <LineTrendChart
              data={data.points.map((point) => ({
                date:
                  point.kind === 'daily' ? point.date : point.bucketStartDate,
                value: point.value,
              }))}
              width={Math.max(220, width - 76)}
              height={48}
              color="#33B866"
              accessibilityLabel="Energy balance trend"
            />
          </View>
          <AppButton
            accessibilityLabel="Open energy balance trend"
            variant="secondary"
            className="min-h-11 rounded-[14px] py-2"
            onPress={onOpenTrend}
          >
            Explore energy trend
          </AppButton>
        </AppCard>
      )}
    </View>
  );
}
