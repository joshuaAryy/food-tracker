import { View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { HeatmapChart } from '@/components/analytics/charts/heatmap-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportSectionState } from '@/lib/analytics/analytics-report-resource';
import type { HeatmapState } from '@/lib/analytics/heatmap-geometry';
import { AnalyticsSectionError } from './analytics-section-error';

function heatmapState(state: string): HeatmapState {
  if (state === 'complete') return 'complete';
  if (state === 'partial') return 'partial';
  if (state === 'unlogged') return 'unlogged';
  return 'unlogged';
}

function colorForState(state: HeatmapState): string {
  if (state === 'complete') return '#00D66B';
  if (state === 'partial') return '#76DBA0';
  return '#E4E8E0';
}

export function LoggingConsistencyCard({
  section,
  onOpenTrend,
  onRetry,
}: {
  section: AnalyticsReportSectionState | undefined;
  onOpenTrend: () => void;
  onRetry: () => void;
}) {
  const data = section?.data ?? null;
  return (
    <View
      testID="simple-insights-section-logging-consistency"
      className="gap-3"
    >
      <ReportingSectionHeading icon="momentum" title="Logging consistency" />
      {data === null ? (
        <AnalyticsSectionError
          title="Logging consistency"
          section={section}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="caption" className="text-muted">
            REPORT · {data.summary.numericDayCount} recorded days
          </AppText>
          <HeatmapChart
            points={data.points.map((point) => ({
              date: point.kind === 'daily' ? point.date : point.bucketStartDate,
              state: heatmapState(
                point.kind === 'daily' ? point.loggingDayState : 'unlogged',
              ),
            }))}
            colorForState={colorForState}
            accessibilityLabel="Logging consistency calendar"
          />
          <AppText variant="caption" className="text-muted">
            Complete, partial, and unlogged days remain distinct from metric
            coverage.
          </AppText>
          <AppButton
            accessibilityLabel="Open logging consistency trend"
            variant="secondary"
            className="min-h-11 rounded-[14px] py-2"
            onPress={onOpenTrend}
          >
            Explore consistency trend
          </AppButton>
        </AppCard>
      )}
    </View>
  );
}
