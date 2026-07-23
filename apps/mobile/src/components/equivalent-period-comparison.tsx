import type { ReportsResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { ReportingSectionHeading } from './reporting-section-heading';
import { reportWindowTitle } from '@/lib/reporting-ui';

function metricValue(value: number): string {
  return Math.abs(value).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
}

export function EquivalentPeriodComparison({
  report,
}: {
  report: ReportsResponse;
}) {
  const comparison = report.comparison;
  const loggedDaysDelta = comparison.loggedDays?.delta;
  const consistencyDelta = comparison.consistency?.delta;
  const summary =
    loggedDaysDelta === undefined && consistencyDelta === undefined
      ? null
      : `${
          loggedDaysDelta === undefined
            ? ''
            : loggedDaysDelta === 0
              ? 'Same logged days'
              : `${metricValue(loggedDaysDelta)} ${loggedDaysDelta > 0 ? 'more' : 'fewer'} logged day${Math.abs(loggedDaysDelta) === 1 ? '' : 's'}`
        }${
          loggedDaysDelta !== undefined && consistencyDelta !== undefined
            ? ' · '
            : ''
        }${
          consistencyDelta === undefined
            ? ''
            : `Consistency ${comparison.consistency?.previous}% → ${comparison.consistency?.current}%`
        }`;

  return (
    <View className="gap-3">
      <ReportingSectionHeading
        icon="compare"
        title="Period comparison"
        compact
      />
      <AppCard elevated className="gap-4">
        <View className="flex-row gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="font-bold text-muted">
              CURRENT
            </AppText>
            <AppText variant="heading" className="text-ink">
              {comparison.loggedDays?.current ?? report.current.loggedDays}{' '}
              logged days
            </AppText>
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="font-bold text-muted">
              PREVIOUS
            </AppText>
            <AppText variant="heading" className="text-ink">
              {comparison.loggedDays?.previous ??
                report.previousCompleted.loggedDays}{' '}
              logged days
            </AppText>
          </View>
        </View>
        <View className="border-t border-line pt-3">
          <AppText variant="caption" className="text-muted">
            {reportWindowTitle(
              report.period,
              'current',
              report.current.boundaries,
            )}
          </AppText>
          <AppText variant="caption" className="text-muted">
            compared with equivalent elapsed period
          </AppText>
        </View>
        {summary === null ? (
          <AppText variant="caption" className="text-muted">
            Keep logging in both periods to unlock a useful comparison.
          </AppText>
        ) : (
          <AppText variant="label" className="text-ink">
            {summary}
          </AppText>
        )}
      </AppCard>
    </View>
  );
}
