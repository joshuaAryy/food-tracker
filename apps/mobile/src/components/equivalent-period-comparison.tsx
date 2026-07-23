import type { ReportsResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppText } from './app-text';
import { reportWindowTitle } from '@/lib/reporting-ui';

function formatMetric(value: number, unit: string): string {
  return `${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 1 })} ${unit}`;
}

export function EquivalentPeriodComparison({
  report,
}: {
  report: ReportsResponse;
}) {
  const comparison = report.comparison;
  const metrics = [
    comparison.loggedDays === undefined
      ? null
      : {
          label: 'Logged days',
          value: comparison.loggedDays.delta,
          unit: 'days',
        },
    comparison.consistency === undefined
      ? null
      : {
          label: 'Consistency',
          value: comparison.consistency.delta,
          unit: 'points',
        },
    comparison.averageCalories === undefined
      ? null
      : {
          label: 'Average calories',
          value: comparison.averageCalories.delta,
          unit: 'kcal',
        },
    comparison.averageProteinGrams === undefined
      ? null
      : {
          label: 'Average protein',
          value: comparison.averageProteinGrams.delta,
          unit: 'g',
        },
  ].filter(
    (metric): metric is { label: string; value: number; unit: string } =>
      metric !== null,
  );

  return (
    <View className="gap-4 border-t border-line pt-5">
      <View className="gap-1">
        <AppText variant="heading" className="text-ink">
          Equivalent comparison
        </AppText>
        <AppText variant="caption" className="text-muted">
          Same elapsed window, kept separate from the full previous period.
        </AppText>
      </View>
      <View className="gap-1 border-t border-line pt-2">
        <AppText variant="caption" className="text-muted">
          {reportWindowTitle(
            report.period,
            'current',
            report.current.boundaries,
          )}
        </AppText>
        <AppText variant="caption" className="text-muted">
          compared with{' '}
          {reportWindowTitle(report.period, 'equivalent', {
            ...report.current.boundaries,
            ...comparison.previousEquivalentBoundary,
            elapsedThroughDate: comparison.previousEquivalentBoundary.endDate,
          })}
        </AppText>
      </View>
      {metrics.length === 0 ? (
        <AppText className="text-muted">
          Keep logging in both windows to unlock a useful comparison.
        </AppText>
      ) : (
        <View>
          {metrics.map((metric) => (
            <View
              key={metric.label}
              className="flex-row items-center gap-3 border-t border-line py-3"
            >
              <AppText variant="label" className="min-w-0 flex-1 text-ink">
                {metric.label}
              </AppText>
              <AppText variant="label" className="text-ink tabular-nums">
                {metric.value === 0
                  ? 'No change'
                  : `${metric.value > 0 ? '+' : '−'}${formatMetric(metric.value, metric.unit)}`}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
