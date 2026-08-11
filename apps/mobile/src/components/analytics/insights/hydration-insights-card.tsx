import { Image, View } from 'react-native';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import hydrationBadge from '@/assets/reporting/hydration-badge.png';
import type { AnalyticsReportSectionState } from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function liters(value: number | null): string {
  return value === null ? '—' : `${(value / 1000).toFixed(2)} L`;
}

export function HydrationInsightsCard({
  section,
  onLogWater,
  onOpenTrend,
  onRetry,
}: {
  section: AnalyticsReportSectionState | undefined;
  onLogWater: () => void;
  onOpenTrend: () => void;
  onRetry: () => void;
}) {
  const data = section?.data ?? null;
  const goal = data?.reference.kind === 'target' ? data.reference.value : null;
  return (
    <View testID="simple-insights-section-hydration" className="gap-3">
      <View className="flex-row items-center gap-3">
        <Image source={hydrationBadge} className="h-[34px] w-[34px]" />
        <AppText variant="heading" className="text-[25px] leading-8 text-ink">
          Hydration
        </AppText>
      </View>
      {data === null ? (
        <AnalyticsSectionError
          title="Hydration"
          section={section}
          onRetry={onRetry}
        />
      ) : (
        <AppCard elevated className="gap-3 p-[18px]">
          <AppText variant="caption" className="text-muted">
            TODAY · Logged drinks only
          </AppText>
          <View className="flex-row items-end justify-between gap-3">
            <AppText variant="number" className="text-[32px] leading-10">
              {liters(data.summary.average)}
            </AppText>
            <AppText variant="caption" className="text-muted">
              {goal === null
                ? 'No goal set'
                : `of ${(goal / 1000).toFixed(1)} L goal`}
            </AppText>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-module">
            <View
              className="h-full rounded-full bg-primary"
              style={{
                width: `${goal === null || data.summary.average === null ? 0 : Math.min(100, (data.summary.average / goal) * 100)}%`,
              }}
            />
          </View>
          <View className="flex-row gap-2">
            <AppButton
              accessibilityLabel="Log water"
              className="min-h-11 flex-1 rounded-[14px] py-2"
              onPress={onLogWater}
            >
              Log water
            </AppButton>
            <AppButton
              accessibilityLabel="Open hydration trend"
              variant="secondary"
              className="min-h-11 flex-1 rounded-[14px] py-2"
              onPress={onOpenTrend}
            >
              7-day trend
            </AppButton>
          </View>
        </AppCard>
      )}
    </View>
  );
}
