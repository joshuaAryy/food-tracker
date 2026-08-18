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

function weekdayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T12:00:00.000Z`))
    .slice(0, 1);
}

function dayWord(count: number): string {
  return count === 1 ? 'day' : 'days';
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
  const mealWeek = mealCoverage.slice(-7);
  const recentDailyPoints = dailyPoints.slice(-10);
  const recentCounts = recentDailyPoints.reduce(
    (counts, point) => {
      if (point.state === 'complete') counts.complete += 1;
      else if (point.state === 'partial') counts.partial += 1;
      else if (point.state === 'unlogged') counts.unlogged += 1;
      return counts;
    },
    { complete: 0, partial: 0, unlogged: 0 },
  );
  const loggedDayCount =
    summary === undefined ? null : summary.complete + summary.partial;
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  return (
    <View testID="logging-consistency-report" className="gap-4">
      <View className="gap-1">
        {summary?.consistency === null ||
        summary?.consistency === undefined ? null : (
          <AppText variant="display" className="text-[38px] leading-[42px]">
            {Math.round(summary.consistency)}%
          </AppText>
        )}
        <AppText variant="caption" className="text-muted">
          {summary === undefined
            ? 'Logging summary unavailable.'
            : `${loggedDayCount} logged days · consistency reflects complete and partial food-log days.`}
        </AppText>
      </View>
      {showPeriodControls ? (
        <TrendPeriodPills
          selectedPeriod={selectedPeriod}
          onSelect={onSelectPeriod}
          simple={simple}
          onOpenCustomRange={onOpenCustomRange}
          periods={[30, 90]}
        />
      ) : null}
      {trend.aggregation === 'daily' ? (
        <View className="gap-2">
          <AppText
            testID="logging-consistency-daily-section-label"
            variant="label"
            className="text-muted uppercase"
          >
            DAILY COMPLETENESS
          </AppText>
          <AppCard
            elevated
            testID="logging-consistency-daily-card"
            className="gap-3 p-[18px]"
            style={{ minHeight: 286 }}
          >
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
            <View
              testID="logging-consistency-week-labels"
              className="flex-row justify-between px-1"
            >
              <AppText variant="caption" className="text-muted">
                Week 1
              </AppText>
              <AppText variant="caption" className="text-muted">
                Week 4
              </AppText>
            </View>
            {recentDailyPoints.length === 0 ? null : (
              <AppText variant="caption" className="text-muted">
                The most recent {recentDailyPoints.length} days contain{' '}
                {recentCounts.complete} complete, {recentCounts.partial} partial
                and {recentCounts.unlogged} unlogged{' '}
                {dayWord(recentCounts.unlogged)}.
              </AppText>
            )}
          </AppCard>
        </View>
      ) : (
        <View className="gap-2">
          <AppText variant="label" className="text-muted uppercase">
            PERIOD PATTERN
          </AppText>
          <AppCard elevated className="gap-3 p-[18px]">
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
        </View>
      )}
      <View className="gap-2">
        <AppText
          testID="logging-consistency-meal-section-label"
          variant="label"
          className="text-muted uppercase"
        >
          MEAL COVERAGE
        </AppText>
        <AppCard
          elevated
          testID="logging-consistency-meal-card"
          className="gap-3 p-4"
          style={{ minHeight: 356 }}
        >
          {mealWeek.length === 0 ? null : (
            <View testID="logging-consistency-meal-coverage" className="gap-3">
              <View className="flex-row items-center gap-3">
                <View className="w-20" />
                <View className="flex-1 flex-row justify-between">
                  {mealWeek.map((day) => (
                    <AppText
                      key={day.date}
                      variant="caption"
                      className="text-center text-muted"
                    >
                      {weekdayLabel(day.date)}
                    </AppText>
                  ))}
                </View>
              </View>
              {mealTypes.map((mealType) => (
                <View key={mealType} className="flex-row items-center gap-3">
                  <AppText variant="caption" className="w-20 capitalize">
                    {mealType}
                  </AppText>
                  <View className="flex-1 flex-row justify-between">
                    {mealWeek.map((day) => (
                      <View
                        key={`${mealType}-${day.date}`}
                        accessible
                        accessibilityLabel={`${formatPresentationDate(day.date)} ${mealType}: ${day[mealType] ? 'logged' : 'not logged'}`}
                        className="h-5 w-5 rounded-[5px]"
                        style={{
                          backgroundColor: day[mealType]
                            ? '#00B86B'
                            : '#E5E7E4',
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
          {mealCoverage.length === 0 ? (
            <AppText variant="caption" className="text-muted">
              Meal coverage is unavailable for this period.
            </AppText>
          ) : null}
        </AppCard>
      </View>
      {summary === undefined ? null : (
        <View className="gap-2">
          <AppText variant="label" className="text-muted uppercase">
            PERIOD PATTERN
          </AppText>
          <AppCard elevated className="gap-2 p-[18px]">
            <AppText variant="heading" className="text-[18px] leading-6">
              Food-log coverage stays separate from nutrient availability.
            </AppText>
            <AppText variant="caption" className="text-muted">
              {summary.consistency === null
                ? 'Complete, partial and unlogged days remain visible for this period.'
                : `${Math.round(summary.consistency)}% of selected days were complete or partial.`}
            </AppText>
          </AppCard>
        </View>
      )}
    </View>
  );
}
