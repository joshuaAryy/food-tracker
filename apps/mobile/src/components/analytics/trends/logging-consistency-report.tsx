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
  if (state === 'complete') return '#33B866';
  if (state === 'partial') return '#FFAD8F';
  if (state === 'in_progress') return '#A5B4A2';
  return '#E7E7E7';
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
      <AppCard elevated className="gap-1 p-[18px]">
        <AppText variant="heading" className="text-[30px] leading-9">
          Logging consistency
        </AppText>
        <AppText variant="caption" className="text-muted">
          {summary === undefined
            ? 'Logging summary unavailable.'
            : `Complete ${summary.complete} · Partial ${summary.partial} · Unlogged ${summary.unlogged}`}
        </AppText>
        {summary?.consistency === null ||
        summary?.consistency === undefined ? null : (
          <AppText variant="heading" className="text-[26px] leading-8">
            {summary.consistency}% consistency
          </AppText>
        )}
        {summary === undefined || summary.inProgress === 0 ? null : (
          <AppText variant="caption" className="text-primary-dark">
            Today is still in progress.
          </AppText>
        )}
        <LoggingDayStateLegend />
      </AppCard>
      {trend.aggregation === 'daily' ? (
        <HeatmapChart
          points={dailyPoints}
          colorForState={color}
          accessibilityLabel="Logging consistency by day"
        />
      ) : (
        <AppCard elevated className="gap-2 p-3">
          <AppText variant="label">Period pattern</AppText>
          <BarTrendChart
            data={aggregatedPoints}
            width={280}
            color="#33B866"
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
      <AppCard className="gap-2 bg-module p-4">
        <AppText variant="label">How to read this</AppText>
        <AppText variant="caption" className="text-muted">
          Logging completeness is based on food-log state. Missing nutrient
          values do not change whether a day is complete.
        </AppText>
      </AppCard>
    </View>
  );
}
