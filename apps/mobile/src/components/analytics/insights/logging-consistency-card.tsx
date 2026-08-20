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
  compact = false,
  presentation = 'simple',
  markerColor,
}: {
  overview: AnalyticsReportOverviewState<'loggingConsistency'> | undefined;
  onRetry: () => void;
  compact?: boolean;
  presentation?: 'simple' | 'complex';
  markerColor?: string;
}) {
  const data = overview?.data ?? null;
  const isComplexOverview = presentation === 'complex' && !compact;
  return (
    <View
      testID="simple-insights-section-logging-consistency"
      className={compact ? 'gap-2' : 'gap-3'}
    >
      <ReportingSectionHeading
        icon="momentum"
        title="Logging consistency"
        compact={compact}
        markerColor={markerColor}
      />
      {data === null ? (
        <AnalyticsSectionError
          title="Logging consistency"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <AppCard
          elevated
          compact={compact}
          testID="logging-consistency-card"
          className={
            compact
              ? 'gap-2 rounded-[12px] p-3'
              : isComplexOverview
                ? 'gap-3 justify-between rounded-[20px] p-[18px]'
                : 'gap-3 p-[18px]'
          }
          style={isComplexOverview ? { minHeight: 260 } : undefined}
        >
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
            columns={isComplexOverview ? 7 : 14}
            cellSize={isComplexOverview ? 18 : 14}
            cellGap={isComplexOverview ? 6 : 4}
            testID="logging-consistency-heatmap"
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
