import type { AnalyticsOverviewLoggingConsistency } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { HeatmapChart } from '@/components/analytics/charts/heatmap-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
import type { HeatmapState } from '@/lib/analytics/heatmap-geometry';
import { AnalyticsSectionError } from './analytics-section-error';

function heatmapState(
  state: AnalyticsOverviewLoggingConsistency['days'][number]['loggingDayState'],
): HeatmapState {
  return state;
}

function colorForState(state: HeatmapState): string {
  if (state === 'complete') return '#00D66B';
  if (state === 'partial') return '#76DBA0';
  return '#E4E8E0';
}

export function LoggingConsistencyCard({
  overview,
  onRetry,
}: {
  overview: AnalyticsReportOverviewState<'loggingConsistency'> | undefined;
  onRetry: () => void;
}) {
  const data = overview?.data ?? null;
  return (
    <View
      testID="simple-insights-section-logging-consistency"
      className="gap-3"
    >
      <ReportingSectionHeading icon="momentum" title="Logging consistency" />
      {data === null ? (
        <AnalyticsSectionError
          title="Logging consistency"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="caption" className="text-muted">
            REPORT · {data.completeDayCount} complete · {data.partialDayCount}{' '}
            partial · {data.unloggedDayCount} unlogged
          </AppText>
          <HeatmapChart
            points={data.days.map((day) => ({
              date: day.date,
              state: heatmapState(day.loggingDayState),
            }))}
            colorForState={colorForState}
            accessibilityLabel="Logging consistency calendar"
          />
          <AppText variant="caption" className="text-muted">
            Current day remains in progress; nutrient availability does not
            change logging completeness.
          </AppText>
        </AppCard>
      )}
    </View>
  );
}
