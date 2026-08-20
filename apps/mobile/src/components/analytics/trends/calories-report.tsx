import type {
  AnalyticsContributorsResponse,
  CanonicalTrendResponse,
} from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { BarTrendChart } from '@/components/analytics/charts/bar-trend-chart';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { formatPresentationDateRange } from '@/lib/date-time';
import { axisReferenceLabel } from '@/lib/analytics/chart-axis';
import { chartStyleForMetric } from '@/lib/analytics/chart-style';
import { CaloriesForecastCard } from './calories-forecast-card';
import { CaloriesSummaryCard } from './calories-summary-card';
import { TrendContributorsCard } from './trend-contributors-card';

const periods = [7, 30, 90] as const;

export function CaloriesReport({
  trend,
  width,
  simple,
  selectedPeriod,
  onSelectPeriod,
  onOpenCustomRange,
  showPeriodControls = true,
  contributors = null,
  onOpenContributors,
}: {
  trend: CanonicalTrendResponse;
  width: number;
  simple: boolean;
  selectedPeriod: 7 | 30 | 90 | null;
  onSelectPeriod: (period: 7 | 30 | 90) => void;
  onOpenCustomRange: () => void;
  showPeriodControls?: boolean;
  contributors?: AnalyticsContributorsResponse | null;
  onOpenContributors: () => void;
}) {
  const counts = trend.loggingSummary;
  const points = trend.points.map((point) => ({
    date: point.kind === 'daily' ? point.date : point.bucketStartDate,
    value: point.value,
  }));
  return (
    <View testID="calories-report" className="gap-4">
      <CaloriesSummaryCard trend={trend} simple={simple} />
      {!showPeriodControls ? null : (
        <View className="flex-row gap-2">
          {periods.map((period) => (
            <Pressable
              key={period}
              accessibilityRole="button"
              accessibilityState={{ selected: period === selectedPeriod }}
              className={`min-h-11 rounded-full px-4 py-3 ${period === selectedPeriod ? 'bg-ink' : 'bg-module'}`}
              onPress={() => onSelectPeriod(period)}
            >
              <AppText
                className={
                  period === selectedPeriod ? 'text-white' : 'text-ink'
                }
              >
                {period}D
              </AppText>
            </Pressable>
          ))}
          {simple ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open custom range"
              className="min-h-11 rounded-full bg-module px-4 py-3"
              onPress={onOpenCustomRange}
            >
              <AppText>Custom</AppText>
            </Pressable>
          )}
        </View>
      )}
      <AppCard elevated className="gap-3 p-3">
        <View className="flex-row justify-between px-1">
          <AppText variant="caption" className="text-muted">
            {formatPresentationDateRange(
              trend.resolvedRange.startDate,
              trend.resolvedRange.endDate,
            )}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {trend.aggregation}
          </AppText>
        </View>
        <BarTrendChart
          data={points}
          width={Math.max(280, width - 40)}
          height={170}
          color="#0E0E0E"
          chartStyle={chartStyleForMetric('calories')}
          barFill="#F3F4EF"
          reference={
            trend.reference.kind === 'range' || trend.reference.kind === 'none'
              ? null
              : trend.reference.value
          }
          referenceRange={
            trend.reference.kind === 'range'
              ? {
                  lower: trend.reference.lower,
                  upper: trend.reference.upper,
                }
              : null
          }
          trendValues={trend.rollingTrend?.values}
          showAxes
          showGrid
          periodDays={selectedPeriod ?? undefined}
          unit={trend.reference.unit}
          referenceLabel={axisReferenceLabel(trend.reference) ?? undefined}
          accessibilityLabel={`Calories trend for ${formatPresentationDateRange(trend.resolvedRange.startDate, trend.resolvedRange.endDate)}`}
        />
        <AppText variant="caption" className="text-muted">
          Selected values remain gaps when no authoritative calorie value was
          recorded.
        </AppText>
      </AppCard>
      <AppCard className="gap-1 bg-module p-4">
        {trend.calorieRangeSummary === undefined ? (
          <AppText variant="caption" className="text-muted">
            Calorie range coverage is unavailable for this period.
          </AppText>
        ) : (
          <>
            <AppText variant="label">
              {trend.calorieRangeSummary.insideRangeDayCount} of{' '}
              {trend.calorieRangeSummary.eligibleDayCount} eligible logged days
              {trend.calorieRangeSummary.status === 'inside_usual_range'
                ? ' were inside your usual range.'
                : trend.calorieRangeSummary.status === 'outside_usual_range'
                  ? ' were outside your usual range.'
                  : ' have enough data for a range comparison.'}
            </AppText>
            <AppText variant="caption" className="text-muted">
              {counts === undefined
                ? 'Logging completeness is unavailable.'
                : `Coverage: ${counts.complete} complete · ${counts.partial} partial · ${counts.unlogged} unlogged.`}
            </AppText>
          </>
        )}
      </AppCard>
      {simple || contributors === null ? null : (
        <TrendContributorsCard
          contributors={contributors.contributors}
          onOpenAll={onOpenContributors}
        />
      )}
      {simple ? null : (
        <CaloriesForecastCard
          forecast={trend.forecast}
          historical={points.map((point) => point.value)}
          historicalDates={points.map((point) => point.date)}
          periodDays={selectedPeriod ?? undefined}
          width={Math.max(260, width - 76)}
        />
      )}
      <AppCard className="gap-1 bg-module p-4">
        <AppText variant="label">Visualization · bars + rolling trend</AppText>
        <AppText variant="caption" className="text-muted">
          The soft trend follows the selected period while missing values stay
          visible as gaps.
        </AppText>
      </AppCard>
    </View>
  );
}
