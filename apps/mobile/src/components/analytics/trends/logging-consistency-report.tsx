import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { BarTrendChart } from '@/components/analytics/charts/bar-trend-chart';
import { HeatmapChart } from '@/components/analytics/charts/heatmap-chart';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { formatPresentationDate } from '@/lib/date-time';
import { LoggingDayStateLegend } from './logging-day-state-legend';
import { TrendPeriodPills } from './trend-period-pills';

function color(state: string): string {
  if (state === 'complete') return '#00D66B';
  if (state === 'partial') return '#76DBA0';
  if (state === 'in_progress') return '#76DBA0';
  return '#E0E0D9';
}

export function LoggingConsistencyReport({
  trend,
  simple,
  selectedPeriod,
  onSelectPeriod,
  onOpenCustomRange,
  showPeriodControls = true,
}: {
  trend: CanonicalTrendResponse;
  simple: boolean;
  selectedPeriod: 7 | 30 | 90 | null;
  onSelectPeriod: (period: 7 | 30 | 90) => void;
  onOpenCustomRange: () => void;
  showPeriodControls?: boolean;
}) {
  const dailyPoints = trend.points.flatMap((point) => {
    if (point.kind !== 'daily') return [];
    return [
      {
        date: point.date,
        state:
          point.loggingDayPhase === 'in_progress'
            ? 'in_progress'
            : point.loggingDayState,
      } as const,
    ];
  });
  const aggregatedPoints = trend.points.flatMap((point) =>
    point.kind === 'aggregated'
      ? [{ date: point.bucketStartDate, value: point.value }]
      : [],
  );
  const summary = trend.loggingSummary;
  const mealCoverage = summary?.mealCoverage ?? [];
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  return (
    <View testID="logging-consistency-report" className="gap-4">
      {showPeriodControls ? (
        <TrendPeriodPills
          selectedPeriod={selectedPeriod}
          onSelect={onSelectPeriod}
          simple={simple}
          onOpenCustomRange={onOpenCustomRange}
          periods={[30, 90]}
        />
      ) : null}
      <View className="gap-1">
        {summary?.consistency === null ||
        summary?.consistency === undefined ? null : (
          <AppText variant="display" className="text-[38px] leading-[42px]">
            {summary.consistency}%
          </AppText>
        )}
        <AppText variant="caption" className="text-muted">
          {summary === undefined
            ? 'Logging summary unavailable.'
            : 'Consistency reflects complete and partial food-log days.'}
        </AppText>
      </View>
      {trend.aggregation === 'daily' ? (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="label">Daily completeness</AppText>
          <LoggingDayStateLegend />
          <HeatmapChart
            points={dailyPoints}
            colorForState={color}
            columns={selectedPeriod === 30 ? 10 : 14}
            cellSize={selectedPeriod === 30 ? 22 : 14}
            cellGap={selectedPeriod === 30 ? 8 : 4}
            testID="logging-consistency-heatmap"
            accessibilityLabel="Logging consistency by day"
          />
        </AppCard>
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="label">Period pattern</AppText>
          <AppText variant="caption" className="text-muted">
            Weekly completeness keeps the 90-day pattern readable without
            compressing individual daily cells.
          </AppText>
          <BarTrendChart
            data={aggregatedPoints}
            width={280}
            height={190}
            color="#6F9870"
            trendValues={trend.rollingTrend?.values}
            accessibilityLabel="Logging consistency aggregated by week"
          />
        </AppCard>
      )}
      <AppCard elevated className="gap-3 p-4">
        <AppText variant="label">Meal coverage</AppText>
        {mealTypes.map((mealType) => (
          <View key={mealType} className="flex-row items-center gap-3">
            <AppText variant="caption" className="w-20 capitalize">
              {mealType}
            </AppText>
            <View className="flex-1 flex-row flex-wrap gap-1">
              {mealCoverage.map((day) => (
                <View
                  key={`${mealType}-${day.date}`}
                  accessible
                  accessibilityLabel={`${formatPresentationDate(day.date)} ${mealType}: ${day[mealType] ? 'logged' : 'not logged'}`}
                  className="h-5 w-5 rounded-[5px]"
                  style={{
                    backgroundColor: day[mealType] ? '#00B86B' : '#E5E7E4',
                  }}
                />
              ))}
            </View>
          </View>
        ))}
        {mealCoverage.length === 0 ? (
          <AppText variant="caption" className="text-muted">
            Meal coverage is unavailable for this period.
          </AppText>
        ) : null}
      </AppCard>
    </View>
  );
}
