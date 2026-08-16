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
      <AppCard elevated className="gap-3 p-[18px]">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          {formatPresentationDateRange(
            trend.resolvedRange.startDate,
            trend.resolvedRange.endDate,
          )}
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
          data={points}
          width={Math.max(196, width - 110)}
          color="#8DB6E2"
          barFill="#E6F2FF"
          reference={goal}
          accessibilityLabel={`Hydration trend for ${formatPresentationDateRange(trend.resolvedRange.startDate, trend.resolvedRange.endDate)}`}
        />
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
