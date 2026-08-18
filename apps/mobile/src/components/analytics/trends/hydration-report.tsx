import type { CanonicalTrendResponse, WaterLog } from '@food-tracker/shared';
import { View } from 'react-native';
import { BarTrendChart } from '@/components/analytics/charts/bar-trend-chart';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import {
  formatPresentationDate,
  formatPresentationDateRange,
} from '@/lib/date-time';
import { formatMetricWithUnit } from '@/lib/reporting-ui';
import { HydrationTargetCard } from './hydration-target-card';

export function HydrationReport({
  trend,
  width,
  onLogWater,
  onOpenWaterLogger,
  quickAddPending,
  quickAddError,
  quickAddUndo,
  recentWaterLogs = [],
}: {
  trend: CanonicalTrendResponse;
  width: number;
  onLogWater: () => void;
  onOpenWaterLogger?: (() => void) | undefined;
  quickAddPending?: boolean;
  quickAddError?: string | null;
  quickAddUndo?: (() => void) | undefined;
  recentWaterLogs?: readonly WaterLog[];
}) {
  const points = trend.points.map((point) => ({
    date: point.kind === 'daily' ? point.date : point.bucketStartDate,
    value: point.value,
  }));
  const goal = trend.reference.kind === 'target' ? trend.reference.value : null;
  const latestIndex = points.reduce(
    (latest, point, index) => (point.value === null ? latest : index),
    -1,
  );
  const latestPoint = latestIndex < 0 ? null : (points[latestIndex] ?? null);
  const weekdayPoints = points.slice(-7);
  const chartStartDate =
    weekdayPoints[0]?.date ?? trend.resolvedRange.startDate;
  const chartEndDate =
    weekdayPoints[weekdayPoints.length - 1]?.date ??
    trend.resolvedRange.endDate;
  return (
    <View testID="hydration-report" className="gap-4">
      <HydrationTargetCard
        goal={goal}
        average={trend.summary.average}
        recordedDayCount={trend.summary.numericDayCount}
        onLogWater={onLogWater}
        onOpenWaterLogger={onOpenWaterLogger}
        quickAddPending={quickAddPending}
        quickAddError={quickAddError}
        quickAddUndo={quickAddUndo}
      />
      <AppCard
        elevated
        testID="hydration-trend-card"
        className="gap-3 p-[18px]"
        style={{ minHeight: 382 }}
      >
        <AppText variant="caption" className="font-bold uppercase text-muted">
          {formatPresentationDateRange(chartStartDate, chartEndDate)}
        </AppText>
        <View className="flex-row justify-between">
          <AppText variant="caption" className="text-muted">
            L
          </AppText>
          {goal === null ? null : (
            <AppText variant="caption" className="text-primary-dark">
              {formatMetricWithUnit(goal / 1000, 'L', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              goal
            </AppText>
          )}
        </View>
        <BarTrendChart
          data={weekdayPoints}
          width={Math.max(196, width - 118)}
          height={190}
          color="#8DB6E2"
          barFill="#E6F2FF"
          showGrid
          initialSelectedIndex={
            weekdayPoints.length === 0 || latestPoint === null
              ? null
              : weekdayPoints.length - 1
          }
          showSelectionTooltip={false}
          reference={goal}
          accessibilityLabel={`Hydration trend for ${formatPresentationDateRange(chartStartDate, chartEndDate)}`}
        />
        <View
          testID="hydration-trend-x-labels"
          className="flex-row justify-between px-1"
        >
          {weekdayPoints.map((point) => (
            <AppText key={point.date} variant="caption" className="text-muted">
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                timeZone: 'UTC',
              })
                .format(new Date(`${point.date}T12:00:00.000Z`))
                .slice(0, 1)}
            </AppText>
          ))}
        </View>
        {latestPoint === null ? null : (
          <View className="flex-row justify-between border-t border-border pt-3">
            <AppText variant="label">
              {formatPresentationDate(latestPoint.date)}
            </AppText>
            <AppText variant="caption" className="text-muted">
              {latestPoint.value === null
                ? 'No recorded value'
                : formatMetricWithUnit(latestPoint.value / 1000, 'L', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{' '}
              · Logged
            </AppText>
          </View>
        )}
      </AppCard>
      <AppCard className="gap-2" elevated>
        <AppText variant="label">THIS WEEK</AppText>
        <AppText variant="caption" className="text-muted">
          {recentWaterLogs.length} explicit water entries in the selected
          period.
        </AppText>
      </AppCard>
      <AppCard className="gap-2" elevated>
        <AppText variant="label">Recent drinks</AppText>
        {recentWaterLogs.length === 0 ? (
          <AppText variant="caption" className="text-muted">
            No explicit water entries in this period.
          </AppText>
        ) : (
          recentWaterLogs
            .slice(-3)
            .reverse()
            .map((waterLog) => (
              <View
                key={waterLog.id}
                className="flex-row items-center justify-between border-b border-border py-2 last:border-b-0"
              >
                <AppText variant="caption">
                  {formatPresentationDate(waterLog.loggedAt.slice(0, 10))}{' '}
                  {new Date(waterLog.loggedAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </AppText>
                <AppText variant="caption" className="text-muted">
                  {waterLog.amountMl} mL
                </AppText>
              </View>
            ))
        )}
      </AppCard>
    </View>
  );
}
