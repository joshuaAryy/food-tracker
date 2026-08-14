import type { AnalyticsOverviewPeriodSummary } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ReportingSectionHeading } from '@/components/reporting-section-heading';
import type { AnalyticsReportOverviewState } from '@/lib/analytics/analytics-report-resource';
import { AnalyticsSectionError } from './analytics-section-error';

function phaseCopy(phase: AnalyticsOverviewPeriodSummary['currentDayPhase']) {
  return phase === 'in_progress' ? 'Today is still in progress.' : null;
}

export function InsightsPeriodSummary({
  period,
  summary,
  onRetry,
  compact = false,
}: {
  period: 'week' | 'month';
  summary: AnalyticsReportOverviewState<'periodSummary'> | undefined;
  onRetry: () => void;
  compact?: boolean;
}) {
  const title = period === 'week' ? 'This week' : 'This month';
  const data = summary?.data ?? null;
  return (
    <View
      testID="simple-insights-section-period-summary"
      className={compact ? 'gap-2' : 'gap-3'}
    >
      <ReportingSectionHeading
        icon="momentum"
        title={title}
        compact={compact}
      />
      {data === null ? (
        <AnalyticsSectionError
          title="Period summary"
          section={summary}
          onRetry={onRetry}
        />
      ) : (
        <AppCard
          elevated
          compact={compact}
          className={compact ? 'gap-2 rounded-[12px] p-3' : 'gap-4 p-[18px]'}
        >
          <View className={compact ? 'flex-row gap-3' : 'flex-row gap-4'}>
            <View className="min-w-0 flex-1 gap-1">
              <AppText variant="caption" className="text-muted">
                Logging streak
              </AppText>
              <AppText
                variant="number"
                className={
                  compact ? 'text-[24px] leading-7' : 'text-[34px] leading-10'
                }
              >
                {data.streak.currentDays}{' '}
                {data.streak.currentDays === 1 ? 'day' : 'days'}
              </AppText>
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <AppText variant="caption" className="text-muted">
                Consistency
              </AppText>
              <AppText
                variant="number"
                className={
                  compact ? 'text-[24px] leading-7' : 'text-[34px] leading-10'
                }
              >
                {data.consistency === null ? '—' : `${data.consistency}%`}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" className="text-muted">
            {data.eligibleLoggedDayCount} of {data.eligibleTotalDayCount}{' '}
            eligible days logged
          </AppText>
          <View className="h-1.5 overflow-hidden rounded-full bg-module-muted">
            <View
              className="h-full rounded-full bg-primary"
              style={{
                width: `${data.consistency ?? 0}%`,
              }}
            />
          </View>
          {phaseCopy(data.currentDayPhase) === null ? null : (
            <AppText variant="caption" className="text-muted">
              {phaseCopy(data.currentDayPhase)}
            </AppText>
          )}
        </AppCard>
      )}
    </View>
  );
}
