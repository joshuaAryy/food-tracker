import type { AnalyticsOverviewLoggingConsistency } from '@food-tracker/shared';
import { useWindowDimensions, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { HeatmapChart } from '@/components/analytics/charts/heatmap-chart';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
import type { HeatmapState } from '@/lib/analytics/heatmap-geometry';
import { AnalyticsSectionError } from './analytics-section-error';

function heatmapState(
  day: AnalyticsOverviewLoggingConsistency['days'][number],
): HeatmapState {
  return day.loggingDayPhase === 'in_progress'
    ? 'in_progress'
    : day.loggingDayState;
}

function colorForState(state: HeatmapState): string {
  if (state === 'complete') return '#00D66B';
  if (state === 'partial') return '#76DBA0';
  if (state === 'in_progress') return '#D99000';
  return '#E4E8E0';
}

export function loggingConsistencyPreviewLayout(
  width: number,
  pointCount = 31,
): {
  columns: number;
  cellSize: number;
  cellGap: number;
  width: number;
} {
  const isShortPeriod = pointCount <= 7;
  const columns = isShortPeriod ? 7 : 10;
  const cellGap = 8;
  const contentWidth = Math.max(0, Math.min(width, 480) - 78);
  const cellSize = Math.max(
    12,
    Math.min(
      isShortPeriod ? 28 : 22,
      Math.floor((contentWidth - (columns - 1) * cellGap) / columns),
    ),
  );
  return {
    columns,
    cellSize,
    cellGap,
    width: columns * cellSize + (columns - 1) * cellGap,
  };
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
  const { width } = useWindowDimensions();
  const previewLayout = loggingConsistencyPreviewLayout(
    width,
    data?.days.length,
  );
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
          style={
            isComplexOverview
              ? { minHeight: data.days.length <= 7 ? 208 : 284 }
              : undefined
          }
        >
          <AppText variant="caption" className="text-muted">
            REPORT · {data.completeDayCount} complete · {data.partialDayCount}{' '}
            partial · {data.unloggedDayCount} unlogged
          </AppText>
          <HeatmapChart
            points={data.days.map((day) => ({
              date: day.date,
              state: heatmapState(day),
            }))}
            colorForState={colorForState}
            accessibilityLabel="Logging consistency calendar"
            columns={isComplexOverview ? previewLayout.columns : 14}
            cellSize={isComplexOverview ? previewLayout.cellSize : 14}
            cellGap={isComplexOverview ? previewLayout.cellGap : 4}
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
