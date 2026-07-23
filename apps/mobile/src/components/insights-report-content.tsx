import type { ReportsResponse } from '@food-tracker/shared';
import { Scale, TrendingUp } from 'lucide-react-native';
import { View } from 'react-native';
import { AppText } from './app-text';
import { CompleteNutrientReport } from './complete-nutrient-report';
import { EnergyReportSummary } from './energy-report-summary';
import { EquivalentPeriodComparison } from './equivalent-period-comparison';
import { FullPeriodReport } from './full-period-report';
import { HighlightedNutrientSummary } from './highlighted-nutrient-summary';
import { MacroReportSummary } from './macro-report-summary';
import { reportWindowTitle } from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

function formatWeight(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} lb`;
}

function CurrentWindowSummary({ report }: { report: ReportsResponse }) {
  const streak = report.current.streak;
  return (
    <View className="gap-3 border-t border-line pt-5">
      <View className="gap-1">
        <AppText variant="heading" className="text-ink">
          {reportWindowTitle(
            report.period,
            'current',
            report.current.boundaries,
          )}
        </AppText>
        <AppText variant="caption" className="text-muted">
          {report.current.loggedDays} logged{' '}
          {report.current.loggedDays === 1 ? 'day' : 'days'} in this window
        </AppText>
      </View>
      <View className="flex-row gap-3 border-t border-line pt-3">
        <View className="min-w-0 flex-1">
          <AppText variant="caption" className="text-muted">
            Logging streak
          </AppText>
          <AppText variant="number" className="text-ink">
            {streak.loggedDays}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {streak.spanDays > streak.loggedDays
              ? `${streak.spanDays}-day span with grace`
              : 'logged days'}
          </AppText>
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="caption" className="text-muted">
            Eligible days
          </AppText>
          <AppText variant="number" className="text-ink">
            {report.current.eligibleDays}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {report.current.consistency.available
              ? `${report.current.consistency.value.percentage}% consistency`
              : 'Building signal'}
          </AppText>
        </View>
      </View>
    </View>
  );
}

function WeightSummary({
  report,
  title = 'Weight direction',
}: {
  report: ReportsResponse['current'];
  title?: string;
}) {
  if (!report.weight.available) return null;
  const weight = report.weight.value;
  return (
    <View className="gap-3 border-t border-line pt-5">
      <View className="flex-row items-center gap-2">
        <Scale color={colors.light.fat} size={18} strokeWidth={2.2} />
        <AppText variant="heading" className="text-ink">
          {title}
        </AppText>
      </View>
      <View className="flex-row gap-3">
        <View className="min-w-0 flex-1">
          <AppText variant="caption" className="text-muted">
            Latest
          </AppText>
          <AppText variant="number" className="text-ink">
            {formatWeight(weight.latestWeightLb)}
          </AppText>
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="caption" className="text-muted">
            Period change
          </AppText>
          <AppText variant="number" className="text-ink">
            {weight.changeLb === null
              ? '—'
              : `${weight.changeLb > 0 ? '+' : ''}${weight.changeLb.toFixed(1)} lb`}
          </AppText>
        </View>
        <View className="min-w-0 flex-1">
          <AppText variant="caption" className="text-muted">
            Direction
          </AppText>
          <View className="mt-1 flex-row items-center gap-1">
            <TrendingUp color={colors.light.fat} size={15} strokeWidth={2.2} />
            <AppText variant="caption" className="text-ink">
              {weight.direction === null ? '—' : weight.direction}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

export function InsightsReportContent({ report }: { report: ReportsResponse }) {
  const currentHasLogs = report.current.loggedDays > 0;
  const previousHasLogs = report.previousCompleted.loggedDays > 0;
  if (!currentHasLogs && !previousHasLogs) return null;

  return (
    <View className="gap-5">
      <CurrentWindowSummary report={report} />
      <EnergyReportSummary report={report.current} />
      <MacroReportSummary report={report.current} />
      <HighlightedNutrientSummary report={report.current} />
      <WeightSummary report={report.current} />
      {report.trackingMode === 'complex' ? (
        <CompleteNutrientReport report={report.current} />
      ) : null}
      <EquivalentPeriodComparison report={report} />
      <FullPeriodReport
        report={report.previousCompleted}
        period={report.period}
      />
      {previousHasLogs ? (
        <View className="gap-5">
          <EnergyReportSummary
            report={report.previousCompleted}
            title="Previous period energy"
          />
          <MacroReportSummary
            report={report.previousCompleted}
            title="Previous period macros"
          />
          <HighlightedNutrientSummary
            report={report.previousCompleted}
            title="Previous highlighted nutrients"
          />
          {report.trackingMode === 'complex' ? (
            <CompleteNutrientReport
              report={report.previousCompleted}
              title="Previous complete nutrient report"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
