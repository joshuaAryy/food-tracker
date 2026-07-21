import type { ReportsResponse } from '@food-tracker/shared';
import { CalendarCheck, Scale, TrendingUp } from 'lucide-react-native';
import { View } from 'react-native';
import { AppCard } from './app-card';
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

function DayStrip({
  days,
}: {
  days: ReportsResponse['current']['dailyBreakdown'];
}) {
  return (
    <View className="gap-2">
      <View className="flex-row justify-between gap-2">
        {days.map((day) => (
          <View key={day.date} className="min-w-0 flex-1 items-center gap-1">
            <View
              className={`h-2.5 w-full rounded-sm ${day.logged ? 'bg-sage-dark' : 'bg-primary-soft'}`}
            />
            <AppText variant="caption" className="text-muted">
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'narrow',
                timeZone: 'UTC',
              }).format(new Date(`${day.date}T12:00:00.000Z`))}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" className="text-muted">
        Filled marks a logged day; the current window ends at the local date
        shown above.
      </AppText>
    </View>
  );
}

function CurrentWindowSummary({ report }: { report: ReportsResponse }) {
  const streak = report.current.streak;
  return (
    <AppCard compact className="gap-3">
      <View className="flex-row items-center gap-2">
        <CalendarCheck color={colors.light.ink} size={18} strokeWidth={2.2} />
        <View className="min-w-0 flex-1">
          <AppText variant="heading" className="text-ink">
            {reportWindowTitle(
              report.period,
              'current',
              report.current.boundaries,
            )}
          </AppText>
          <AppText variant="caption" className="text-muted">
            Sunday–Saturday rhythm · {report.current.loggedDays} logged{' '}
            {report.current.loggedDays === 1 ? 'day' : 'days'}
          </AppText>
        </View>
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
      <View className="border-t border-line pt-3">
        <DayStrip days={report.current.dailyBreakdown} />
      </View>
    </AppCard>
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
