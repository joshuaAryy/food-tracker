import { Pressable, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from '@/lib/analytics/analytics-report-resource';
import { hydrationVesselFillLevels } from '@/lib/analytics/overview-visuals';
import { formatMetricValue, formatMetricWithUnit } from '@/lib/reporting-ui';
import { AnalyticsSectionError } from './analytics-section-error';
import { HydrationVessel } from './hydration-vessel';

function liters(value: number | null): string {
  return formatMetricWithUnit(value === null ? null : value / 1000, 'L', {
    maximumFractionDigits: 1,
  });
}

export function HydrationInsightsCard({
  overview,
  trend,
  onLogWater,
  onOpenTrend,
  onRetry,
  compact = false,
  presentation = 'simple',
  markerColor,
}: {
  overview: AnalyticsReportOverviewState<'hydration'> | undefined;
  trend: AnalyticsReportSectionState | undefined;
  onLogWater: () => void;
  onOpenTrend: () => void;
  onRetry: () => void;
  compact?: boolean;
  presentation?: 'simple' | 'complex';
  markerColor?: string;
}) {
  const data = overview?.data ?? null;
  const goal = data?.goal ?? null;
  const vesselFills =
    data === null || goal === null
      ? []
      : hydrationVesselFillLevels(data.total, goal);
  const fullVesselCount = vesselFills.filter((fill) => fill === 1).length;
  const isComplexOverview = presentation === 'complex' && !compact;
  const recordedHydrationDays = trend?.data?.summary.numericDayCount ?? 0;
  const vesselSummary =
    data === null
      ? 'Hydration data unavailable'
      : goal === null
        ? 'Hydration goal unavailable'
        : data.total === null
          ? recordedHydrationDays > 0
            ? 'No water logged today'
            : 'No hydration history yet'
          : `${fullVesselCount} of 8 glasses`;
  return (
    <View
      testID="simple-insights-section-hydration"
      className={compact ? 'gap-2' : 'gap-3'}
    >
      <ReportingSectionHeading
        icon="detail"
        title="Hydration"
        compact={compact}
        markerColor={markerColor}
      />
      {data === null ? (
        <AnalyticsSectionError
          title="Hydration"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <AppCard
          compact={compact}
          testID="hydration-insights-card"
          className={
            compact
              ? 'gap-2 rounded-[16px] p-3'
              : isComplexOverview
                ? 'gap-2 justify-between rounded-[18px] p-[18px]'
                : 'gap-2 rounded-[18px] p-[14px]'
          }
          style={isComplexOverview ? { minHeight: 248 } : undefined}
        >
          <AppText variant="caption" className="text-muted">
            TODAY · Logged drinks only
          </AppText>
          <View className="flex-row items-end justify-between gap-3">
            <AppText
              variant="number"
              className={
                compact ? 'text-[24px] leading-7' : 'text-[28px] leading-8'
              }
            >
              {liters(data.total)}
            </AppText>
            <AppText variant="caption" className="text-muted">
              {goal === null ? (
                'Goal unavailable'
              ) : (
                <>
                  of{' '}
                  {formatMetricValue(goal / 1000, {
                    maximumFractionDigits: 1,
                  })}{' '}
                  L goal
                </>
              )}
            </AppText>
          </View>
          <View
            accessible
            accessibilityLabel={`Hydration vessel progress: ${vesselSummary}`}
            testID="hydration-vessel-row"
            className={
              isComplexOverview
                ? 'flex-row items-end gap-5 px-1 py-1'
                : 'flex-row items-end gap-[15px] py-1'
            }
          >
            {vesselFills.map((fill, index) => (
              <View
                key={`vessel-${index}`}
                testID={`hydration-vessel-visual-${index}`}
                style={
                  isComplexOverview
                    ? {
                        transform: [{ scaleX: 26 / 18 }, { scaleY: 36 / 32 }],
                      }
                    : undefined
                }
              >
                <HydrationVessel fill={fill} index={index} compact={compact} />
              </View>
            ))}
          </View>
          <View
            testID="hydration-insights-actions"
            className="flex-row items-center gap-2"
          >
            <AppText variant="label" className="min-w-0 flex-1">
              {vesselSummary}
            </AppText>
            <AppButton
              testID="hydration-quick-add"
              accessibilityLabel="Log water"
              className={
                compact
                  ? 'min-h-8 rounded-[16px] px-3 py-1'
                  : 'min-h-8 min-w-[104px] rounded-[17px] px-3 py-1'
              }
              onPress={onLogWater}
            >
              + 250 mL
            </AppButton>
          </View>
          <Pressable
            testID="hydration-other-amount"
            accessibilityRole="button"
            accessibilityLabel="Open other water amount"
            className={
              isComplexOverview
                ? 'min-h-7 self-center px-2 py-1'
                : 'min-h-8 self-end rounded-[12px] bg-water-soft px-3 py-1'
            }
            onPress={onLogWater}
          >
            <AppText
              variant="caption"
              numberOfLines={1}
              className={
                isComplexOverview
                  ? 'text-center text-[11px] font-semibold leading-4 text-[#337CCA]'
                  : 'text-center font-semibold text-[#337CCA]'
              }
            >
              Other amount ›
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open hydration trend"
            onPress={onOpenTrend}
          >
            <View className="flex-row items-center justify-between border-t border-line pt-2">
              <AppText variant="label">7-day hydration trend</AppText>
              <AppText variant="heading" className="text-muted">
                ›
              </AppText>
            </View>
          </Pressable>
          {trend?.data === null || trend?.data === undefined ? null : (
            <AppText variant="caption" className="text-muted">
              {recordedHydrationDays} recorded hydration days
            </AppText>
          )}
        </AppCard>
      )}
    </View>
  );
}
