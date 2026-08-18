import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import {
  formatPresentationDate,
  formatPresentationDateRange,
} from '@/lib/date-time';
import { formatMetricValue, formatMetricWithUnit } from '@/lib/reporting-ui';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import { referenceLineY } from '@/lib/analytics/chart-geometry';
import { WeightDirectionCard } from './weight-direction-card';
import { TrendPeriodPills } from './trend-period-pills';
import { ForecastUnavailableCard } from './forecast-unavailable-card';

function latestValue(trend: CanonicalTrendResponse): number | null {
  for (const point of [...trend.points].reverse()) {
    if (point.value !== null) return point.value;
  }
  return null;
}

export function WeightReport({
  trend,
  width,
  simple,
  selectedPeriod,
  onSelectPeriod,
  onOpenCustomRange,
  showPeriodControls = true,
}: {
  trend: CanonicalTrendResponse;
  width: number;
  simple: boolean;
  selectedPeriod: 7 | 30 | 90 | null;
  onSelectPeriod: (period: 7 | 30 | 90) => void;
  onOpenCustomRange: () => void;
  showPeriodControls?: boolean;
}) {
  const latest = latestValue(trend);
  const points = trend.points.map((point) => ({
    date: point.kind === 'daily' ? point.date : point.bucketStartDate,
    value: point.value,
  }));
  const facts = trend.weightFacts;
  const target =
    facts?.target ??
    (trend.reference.kind === 'target' ? trend.reference.value : null);
  const axisDomain = fixedDomain(
    [
      ...points.map((point) => point.value),
      ...(trend.rollingTrend?.values ?? []),
      ...(target === null ? [] : [target]),
    ],
    { includeZero: false },
  );
  const axisLabels =
    axisDomain === null
      ? ['—', '—', '—']
      : [
          axisDomain.max,
          (axisDomain.max + axisDomain.min) / 2,
          axisDomain.min,
        ].map((value) => formatMetricValue(value));
  const latestPoint = [...trend.points]
    .reverse()
    .find((point) => point.value !== null);
  const latestIndex =
    latestPoint === undefined
      ? null
      : trend.points.findIndex((point) => point === latestPoint);
  const targetY =
    axisDomain === null || target === null
      ? null
      : referenceLineY(target, axisDomain, 190);
  const rollingValues = trend.rollingTrend?.values;
  const hasRenderableRollingTrend =
    rollingValues !== undefined &&
    rollingValues.filter((value) => value !== null && Number.isFinite(value))
      .length >= 2;
  const chartWidth = Math.max(196, width - 118);
  const availableForecast =
    trend.forecast?.kind === 'available' ? trend.forecast : null;
  const finalForecastPoint = availableForecast?.points.at(-1);
  const recentWeighIns = trend.points
    .filter((point) => point.kind === 'daily')
    .slice(-20);
  return (
    <View testID="weight-report" className="gap-4">
      <View className="gap-1">
        <AppText
          variant="heading"
          className="text-[30px] leading-9 tabular-nums"
        >
          {facts?.current === null || facts?.current === undefined
            ? latest === null
              ? 'Unknown'
              : formatMetricWithUnit(latest, 'lb')
            : formatMetricWithUnit(facts.current, 'lb')}
        </AppText>
        {facts?.change === null || facts?.change === undefined ? null : (
          <AppText variant="label" className="text-success">
            {facts.change > 0 ? '+' : ''}
            {formatMetricWithUnit(facts.change, 'lb')} over the selected period
          </AppText>
        )}
      </View>
      {showPeriodControls ? (
        <TrendPeriodPills
          selectedPeriod={selectedPeriod}
          onSelect={onSelectPeriod}
          simple={simple}
          onOpenCustomRange={onOpenCustomRange}
        />
      ) : null}
      <AppCard
        elevated
        testID="weight-trend-card"
        className="gap-3 p-[18px]"
        style={{ minHeight: 372 }}
      >
        <AppText variant="caption" className="font-bold uppercase text-muted">
          {formatPresentationDateRange(
            trend.resolvedRange.startDate,
            trend.resolvedRange.endDate,
          )}
        </AppText>
        <View testID="weight-chart-axis" className="flex-row gap-2">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              lb
            </AppText>
            <View
              testID="weight-trend-chart"
              className="relative"
              style={{ height: 190, width: chartWidth }}
            >
              <LineTrendChart
                data={points}
                width={chartWidth}
                height={190}
                color="#789776"
                areaColor="#789776"
                showGrid
                showRawPoints
                initialSelectedIndex={latestIndex}
                showSelectionTooltip={false}
                showSelectionDescription={false}
                trendValues={
                  hasRenderableRollingTrend ? rollingValues : undefined
                }
                connectTrendGaps={hasRenderableRollingTrend}
                reference={target}
                accessibilityLabel={`Weight trend for ${formatPresentationDateRange(trend.resolvedRange.startDate, trend.resolvedRange.endDate)}`}
              />
              {targetY === null ? null : (
                <View
                  testID="weight-goal-reference"
                  pointerEvents="none"
                  className="absolute right-1"
                  style={{ top: Math.max(0, targetY - 12), right: -4 }}
                >
                  <AppText variant="caption" className="text-sage">
                    Goal {formatMetricWithUnit(target, 'lb')}
                  </AppText>
                </View>
              )}
            </View>
          </View>
          <View className="h-[190px] justify-between py-1">
            {axisLabels.map((label, index) => (
              <AppText
                key={`${label}-${index}`}
                variant="caption"
                className="text-muted"
              >
                {label}
              </AppText>
            ))}
          </View>
        </View>
        <View
          testID="weight-chart-x-labels"
          className="flex-row justify-between"
          style={{ width: chartWidth }}
        >
          <AppText variant="caption" className="text-muted">
            {formatPresentationDate(trend.resolvedRange.startDate)}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {formatPresentationDate(trend.resolvedRange.endDate)}
          </AppText>
        </View>
        {latestPoint === undefined ? null : (
          <View className="flex-row justify-between border-t border-border pt-3">
            <AppText variant="label">
              {formatPresentationDate(
                latestPoint.kind === 'daily'
                  ? latestPoint.date
                  : latestPoint.bucketStartDate,
              )}
            </AppText>
            <AppText variant="caption" className="text-muted">
              {latest === null ? 'Unknown' : formatMetricWithUnit(latest, 'lb')}{' '}
              · Raw weigh-in
            </AppText>
          </View>
        )}
      </AppCard>
      <WeightDirectionCard facts={facts} />
      {facts?.recordedDayCount === undefined ||
      facts.eligibleDayCount === undefined ? null : (
        <View testID="weight-weigh-in-coverage" className="gap-3">
          <AppText variant="label" className="text-muted uppercase">
            WEIGH-IN COVERAGE
          </AppText>
          <AppText variant="heading" className="text-[17px] leading-6">
            {facts.recordedDayCount} weigh-ins across {facts.eligibleDayCount}{' '}
            days
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            {recentWeighIns.map((point) => {
              const date = point.date;
              const recorded = point.value !== null;
              return (
                <View
                  key={date}
                  testID="weight-weigh-in-cell"
                  accessible
                  accessibilityLabel={`${formatPresentationDate(date)}: ${recorded ? 'recorded weigh-in' : 'no weigh-in'}`}
                  className="h-6 w-6 rounded-[6px]"
                  style={{
                    backgroundColor: recorded ? '#00D66B' : '#E4E8E0',
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
      <AppCard
        elevated
        testID="weight-display-card"
        className="gap-4 bg-module p-[18px]"
        style={{ minHeight: 142 }}
      >
        <AppText variant="caption" className="font-bold text-muted">
          Display
        </AppText>
        <View className="flex-row items-center justify-between gap-3">
          <AppText variant="label">Smoothed trend</AppText>
          <AppText variant="caption" className="text-muted">
            Raw points visible
          </AppText>
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <AppText variant="label">Goal reference</AppText>
          <AppText
            variant="caption"
            className={target === null ? 'text-muted' : 'text-success'}
          >
            {target === null ? 'Not configured' : 'Shown'}
          </AppText>
        </View>
      </AppCard>
      {availableForecast === null || finalForecastPoint === undefined ? null : (
        <AppCard
          elevated
          testID="weight-forecast"
          className="gap-2 bg-module p-[18px]"
        >
          <AppText variant="caption" className="font-bold text-muted">
            Weight forecast
          </AppText>
          <AppText variant="heading" className="text-[20px] leading-7">
            {formatMetricValue(finalForecastPoint.lower)}–
            {formatMetricWithUnit(finalForecastPoint.upper, 'lb')}
          </AppText>
          <AppText variant="caption" className="text-muted">
            Seven-day estimate after{' '}
            {formatPresentationDate(availableForecast.todayDate)}. Raw weigh-ins
            and the goal reference remain separate from this derived projection.
          </AppText>
        </AppCard>
      )}
      {trend.forecast?.kind === 'unavailable' ? (
        <ForecastUnavailableCard metric="weight" />
      ) : null}
    </View>
  );
}
