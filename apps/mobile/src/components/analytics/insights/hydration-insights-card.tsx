import { Pressable, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type {
  AnalyticsReportOverviewState,
  AnalyticsReportSectionState,
} from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function liters(value: number | null): string {
  return value === null ? '—' : `${(value / 1000).toFixed(2)} L`;
}

export function HydrationInsightsCard({
  overview,
  trend,
  onLogWater,
  onOpenTrend,
  onRetry,
}: {
  overview: AnalyticsReportOverviewState<'hydration'> | undefined;
  trend: AnalyticsReportSectionState | undefined;
  onLogWater: () => void;
  onOpenTrend: () => void;
  onRetry: () => void;
}) {
  const data = overview?.data ?? null;
  const progress =
    data === null || data.total === null || data.goal <= 0
      ? 0
      : Math.min(100, (data.total / data.goal) * 100);
  return (
    <View testID="simple-insights-section-hydration" className="gap-3">
      <ReportingSectionHeading icon="detail" title="Hydration" />
      {data === null ? (
        <AnalyticsSectionError
          title="Hydration"
          section={overview}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="caption" className="text-muted">
            TODAY · Logged drinks only
          </AppText>
          <View className="flex-row items-end justify-between gap-3">
            <AppText variant="number" className="text-[32px] leading-10">
              {liters(data.total)}
            </AppText>
            <AppText variant="caption" className="text-muted">
              of {(data.goal / 1000).toFixed(1)} L goal
            </AppText>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-module">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <AppText variant="label">
              {data.total === null
                ? 'No water logged today'
                : 'Explicit water total'}
            </AppText>
            <AppButton
              accessibilityLabel="Log water"
              className="min-h-10 rounded-[19px] px-4 py-1"
              onPress={onLogWater}
            >
              + 250 mL
            </AppButton>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open other water amount"
            onPress={onLogWater}
          >
            <AppText variant="caption" className="text-primary-dark">
              Other amount ›
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open hydration trend"
            onPress={onOpenTrend}
          >
            <View className="flex-row items-center justify-between border-t border-line pt-3">
              <AppText variant="label">7-day hydration trend</AppText>
              <AppText variant="heading" className="text-muted">
                ›
              </AppText>
            </View>
          </Pressable>
          {trend?.data === null || trend?.data === undefined ? null : (
            <AppText variant="caption" className="text-muted">
              {trend.data.summary.numericDayCount} recorded hydration days
            </AppText>
          )}
        </AppCard>
      )}
    </View>
  );
}
