import type { CanonicalTrendResponse, WaterLog } from '@food-tracker/shared';
import { View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import {
  formatPresentationDate,
  formatPresentationDateRange,
} from '@/lib/date-time';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import { pointY, referenceLineY } from '@/lib/analytics/chart-geometry';
import { formatMetricWithUnit } from '@/lib/reporting-ui';
import { HydrationTargetCard } from './hydration-target-card';

const HYDRATION_BLUE = '#337AC7';
const HYDRATION_OUTLINE = '#8DB6E2';
const HYDRATION_FILL = '#E6F2FF';
const HYDRATION_PLOT_HEIGHT = 190;
const HYDRATION_PLOT_INSET = 8;
const HYDRATION_MARKER_RADIUS = 6;

type HydrationDailyPoint = {
  date: string;
  value: number | null;
};

function HydrationDailyVesselPlot({
  data,
  width,
  goal,
  selectedIndex,
}: {
  data: readonly HydrationDailyPoint[];
  width: number;
  goal: number | null;
  selectedIndex: number | null;
}) {
  const baseDomain = fixedDomain(
    [...data.map((point) => point.value), ...(goal === null ? [] : [goal])],
    { includeZero: true },
  );
  const domain =
    baseDomain === null
      ? null
      : {
          ...baseDomain,
          max: Math.max(baseDomain.max, goal ?? 0) * 1.3,
        };
  const slotWidth = width / Math.max(data.length, 1);
  const vesselWidth = Math.min(20, Math.max(12, slotWidth * 0.48));
  const plotHeight = HYDRATION_PLOT_HEIGHT - HYDRATION_PLOT_INSET * 2;
  const baseline =
    domain === null
      ? HYDRATION_PLOT_HEIGHT
      : HYDRATION_PLOT_INSET + pointY(0, domain, plotHeight);
  const selected =
    selectedIndex === null ? null : (data[selectedIndex] ?? null);
  const selectedX =
    selectedIndex === null ? null : selectedIndex * slotWidth + slotWidth / 2;
  const selectedY =
    selected === null || selected.value === null || domain === null
      ? null
      : HYDRATION_PLOT_INSET + pointY(selected.value, domain, plotHeight);

  return (
    <View
      testID="hydration-daily-vessel-plot"
      style={{ width, height: HYDRATION_PLOT_HEIGHT }}
    >
      <Svg
        width={width}
        height={HYDRATION_PLOT_HEIGHT}
        viewBox={`0 0 ${width} ${HYDRATION_PLOT_HEIGHT}`}
        accessibilityLabel="Daily explicit hydration totals"
      >
        {[0.5, 0.75].map((fraction) => (
          <Line
            key={`hydration-grid-${fraction}`}
            x1={0}
            x2={width}
            y1={HYDRATION_PLOT_HEIGHT * fraction}
            y2={HYDRATION_PLOT_HEIGHT * fraction}
            stroke="#E4E8E5"
            strokeWidth={1}
          />
        ))}
        {goal === null || domain === null ? null : (
          <Line
            testID="hydration-goal-reference"
            x1={0}
            x2={width}
            y1={HYDRATION_PLOT_INSET + referenceLineY(goal, domain, plotHeight)}
            y2={HYDRATION_PLOT_INSET + referenceLineY(goal, domain, plotHeight)}
            stroke={HYDRATION_BLUE}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
        {data.map((point, index) => {
          const x = index * slotWidth + (slotWidth - vesselWidth) / 2;
          if (point.value === null || domain === null) {
            const centerX = x + vesselWidth / 2;
            const missingY = Math.max(
              HYDRATION_PLOT_INSET + HYDRATION_MARKER_RADIUS,
              baseline - 18,
            );
            return (
              <Circle
                key={point.date}
                testID={`hydration-missing-observation-${index}`}
                cx={centerX}
                cy={missingY}
                r={HYDRATION_MARKER_RADIUS}
                fill="#FFFFFF"
                stroke="#7A95AB"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                accessibilityLabel={`No hydration total recorded for ${point.date}`}
              />
            );
          }
          const y =
            HYDRATION_PLOT_INSET + pointY(point.value, domain, plotHeight);
          return (
            <Rect
              key={point.date}
              testID={`hydration-daily-vessel-${index}`}
              x={x}
              y={Math.min(y, baseline)}
              width={vesselWidth}
              height={Math.abs(baseline - y)}
              rx={vesselWidth / 2}
              fill={HYDRATION_FILL}
              stroke={HYDRATION_OUTLINE}
              strokeWidth={1}
            />
          );
        })}
        {selectedX === null ? null : (
          <Line
            testID="hydration-selected-guide"
            x1={selectedX}
            x2={selectedX}
            y1={0}
            y2={HYDRATION_PLOT_HEIGHT}
            stroke="#7A7A74"
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.45}
          />
        )}
        {selectedX === null || selectedY === null ? null : (
          <Circle
            testID="hydration-selected-observation"
            cx={selectedX}
            cy={selectedY}
            r={HYDRATION_MARKER_RADIUS}
            fill={HYDRATION_OUTLINE}
            stroke="#FFFFFF"
            strokeWidth={3}
          />
        )}
      </Svg>
    </View>
  );
}

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
  const weekdayPoints = points.slice(-7);
  const latestWeekdayIndex = weekdayPoints.reduce(
    (latest, point, index) => (point.value === null ? latest : index),
    -1,
  );
  const latestPoint =
    latestWeekdayIndex < 0 ? null : (weekdayPoints[latestWeekdayIndex] ?? null);
  const chartStartDate =
    weekdayPoints[0]?.date ?? trend.resolvedRange.startDate;
  const chartEndDate =
    weekdayPoints[weekdayPoints.length - 1]?.date ??
    trend.resolvedRange.endDate;
  const chartWidth = Math.max(196, width - 118);
  const recordedWeekdayPoints = weekdayPoints.filter(
    (point): point is HydrationDailyPoint & { value: number } =>
      point.value !== null,
  );
  const totalWeekdayMl = recordedWeekdayPoints.reduce(
    (total, point) => total + point.value,
    0,
  );
  const goalProgressDayCount =
    goal === null
      ? null
      : recordedWeekdayPoints.filter((point) => point.value >= goal * 0.75)
          .length;
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
        testID="hydration-trend-card"
        className="gap-3 rounded-[18px] p-[18px]"
        style={{ minHeight: 382, marginTop: 16 }}
      >
        <AppText variant="caption" className="font-bold uppercase text-muted">
          {formatPresentationDateRange(chartStartDate, chartEndDate)}
        </AppText>
        <View className="flex-row justify-between">
          <AppText variant="caption" className="text-muted">
            L
          </AppText>
          {goal === null ? null : (
            <AppText variant="caption" className="font-bold text-[#337AC7]">
              {formatMetricWithUnit(goal / 1000, 'L', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              goal
            </AppText>
          )}
        </View>
        <HydrationDailyVesselPlot
          data={weekdayPoints}
          width={chartWidth}
          goal={goal}
          selectedIndex={latestWeekdayIndex < 0 ? null : latestWeekdayIndex}
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
      <View className="gap-3">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          THIS WEEK
        </AppText>
        <AppCard
          testID="hydration-this-week-card"
          className="min-h-[162px] gap-3 rounded-[18px] p-[18px]"
        >
          {recordedWeekdayPoints.length === 0 ? (
            <AppText variant="caption" className="text-muted">
              No explicit hydration totals were recorded this week.
            </AppText>
          ) : (
            <>
              <AppText variant="heading" className="text-[24px] leading-8">
                {formatMetricWithUnit(totalWeekdayMl / 1000, 'L', {
                  maximumFractionDigits: 1,
                })}
              </AppText>
              <AppText variant="caption" className="text-muted">
                {goalProgressDayCount === null
                  ? `${recordedWeekdayPoints.length} recorded hydration days this week`
                  : `${goalProgressDayCount} of ${recordedWeekdayPoints.length} recorded days reached at least 75% of goal`}
              </AppText>
            </>
          )}
          <AppText variant="caption" className="mt-auto text-muted">
            Hydration excludes water contained in foods. Only explicit drink
            logs count toward this goal.
          </AppText>
        </AppCard>
      </View>
      <View className="gap-3">
        <AppText variant="caption" className="font-bold uppercase text-muted">
          RECENT DRINKS
        </AppText>
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
                className="min-h-12 flex-row items-center justify-between border-b border-border py-2 last:border-b-0"
              >
                <View className="min-w-0 flex-1 gap-0.5 pr-3">
                  <AppText variant="label">Water</AppText>
                  <AppText variant="caption" className="text-muted">
                    {formatPresentationDate(waterLog.loggedAt.slice(0, 10))}{' '}
                    {new Date(waterLog.loggedAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </AppText>
                </View>
                <AppText variant="caption" className="text-muted">
                  {waterLog.amountMl} mL
                </AppText>
              </View>
            ))
        )}
      </View>
    </View>
  );
}
