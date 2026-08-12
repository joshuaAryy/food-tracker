import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
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
  return (
    <View testID="weight-report" className="gap-4">
      <AppCard elevated className="gap-1 p-[18px]">
        <AppText
          variant="heading"
          className="text-[30px] leading-9 tabular-nums"
        >
          {facts?.current === null || facts?.current === undefined
            ? latest === null
              ? 'Unknown'
              : `${latest.toFixed(1)} lb`
            : `${facts.current.toFixed(1)} lb`}
        </AppText>
        <AppText variant="caption" className="text-muted">
          Latest authoritative weight
        </AppText>
        {target === null ? null : (
          <AppText variant="caption" className="text-primary-dark">
            Goal reference {target.toFixed(1)} lb
          </AppText>
        )}
      </AppCard>
      {showPeriodControls ? (
        <TrendPeriodPills
          selectedPeriod={selectedPeriod}
          onSelect={onSelectPeriod}
          simple={simple}
          onOpenCustomRange={onOpenCustomRange}
        />
      ) : null}
      <AppCard elevated className="gap-3 p-3">
        <AppText variant="caption" className="text-muted">
          {trend.resolvedRange.startDate} — {trend.resolvedRange.endDate}
        </AppText>
        <LineTrendChart
          data={points}
          width={Math.max(260, width - 76)}
          color="#111111"
          showRawPoints
          trendValues={trend.rollingTrend?.values}
          reference={target}
          accessibilityLabel={`Weight trend from ${trend.resolvedRange.startDate} through ${trend.resolvedRange.endDate}`}
        />
      </AppCard>
      <WeightDirectionCard facts={facts} />
      {facts?.recordedDayCount === undefined ||
      facts.eligibleDayCount === undefined ? null : (
        <AppCard className="gap-1 bg-module p-4">
          <AppText variant="label">Weigh-in coverage</AppText>
          <AppText variant="caption" className="text-muted">
            {facts.recordedDayCount} of {facts.eligibleDayCount} days recorded
          </AppText>
        </AppCard>
      )}
      {trend.forecast?.kind === 'unavailable' ? (
        <ForecastUnavailableCard metric="weight" />
      ) : null}
    </View>
  );
}
