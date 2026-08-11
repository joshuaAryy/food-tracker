import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';

function elapsedDayCount(section: CanonicalTrendResponse | null): number {
  if (section === null) return 0;
  return section.points.filter((point) => point.kind === 'daily').length;
}

function loggedDayCount(section: CanonicalTrendResponse | null): number {
  if (section === null) return 0;
  return section.points.filter(
    (point) => point.kind === 'daily' && point.foodLogCount > 0,
  ).length;
}

export function InsightsPeriodSummary({
  period,
  consistency,
}: {
  period: 'week' | 'month';
  consistency: CanonicalTrendResponse | null;
}) {
  const title = period === 'week' ? 'This week' : 'This month';
  const elapsedDays = elapsedDayCount(consistency);
  const loggedDays = loggedDayCount(consistency);
  const average = consistency?.summary.average;
  const consistencyLabel =
    average === null || average === undefined ? '—' : `${Math.round(average)}%`;
  return (
    <View testID="simple-insights-section-period-summary" className="gap-3">
      <ReportingSectionHeading icon="momentum" title={title} />
      <AppCard elevated className="gap-4 p-[18px]">
        <View className="flex-row gap-4">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              Logging streak
            </AppText>
            <AppText variant="number" className="text-[34px] leading-10">
              {loggedDays} {loggedDays === 1 ? 'day' : 'days'}
            </AppText>
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              Consistency
            </AppText>
            <AppText variant="number" className="text-[34px] leading-10">
              {consistencyLabel}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" className="text-muted">
          {loggedDays} of {elapsedDays} elapsed days logged
        </AppText>
        <View className="h-2 overflow-hidden rounded-full bg-module">
          <View
            className="h-full rounded-full bg-primary"
            style={{
              width: `${elapsedDays === 0 ? 0 : (loggedDays / elapsedDays) * 100}%`,
            }}
          />
        </View>
      </AppCard>
    </View>
  );
}
