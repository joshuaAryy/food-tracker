import { useWindowDimensions, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportSectionState } from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

export function WeightDirectionCard({
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
  const value = data?.summary.average;
  return (
    <View testID="simple-insights-section-weight-direction" className="gap-3">
      <ReportingSectionHeading icon="weight" title="Weight direction" />
      {data === null ? (
        <AnalyticsSectionError
          title="Weight"
          section={section}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="caption" className="text-muted">
            REPORT · Current weight
          </AppText>
          <AppText variant="number" className="text-[30px] leading-9">
            {value === null || value === undefined
              ? '—'
              : `${value.toFixed(1)} lb`}
          </AppText>
          <View className="rounded-[12px] bg-module p-2">
            <LineTrendChart
              data={data.points.map((point) => ({
                date:
                  point.kind === 'daily' ? point.date : point.bucketStartDate,
                value: point.value,
              }))}
              width={Math.max(220, width - 76)}
              height={44}
              color="#337AC7"
              accessibilityLabel="Weight direction trend"
            />
          </View>
          <AppButton
            accessibilityLabel="Open weight trend"
            variant="secondary"
            className="min-h-11 rounded-[14px] py-2"
            onPress={onOpenTrend}
          >
            Explore weight trend
          </AppButton>
        </AppCard>
      )}
    </View>
  );
}
