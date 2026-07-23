import type { ReportsResponse } from '@food-tracker/shared';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { CompleteNutrientReport } from './complete-nutrient-report';
import { EnergyReportSummary } from './energy-report-summary';
import { EquivalentPeriodComparison } from './equivalent-period-comparison';
import { FullPeriodReport } from './full-period-report';
import { HighlightedNutrientSummary } from './highlighted-nutrient-summary';
import { MacroReportSummary } from './macro-report-summary';
import { ReportingSectionHeading } from './reporting-section-heading';

function formatWeight(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)} lb`;
}

function CurrentWindowSummary({ report }: { report: ReportsResponse }) {
  const streak = report.current.streak;
  const periodLabel = report.period === 'week' ? 'This week' : 'This month';
  const consistency = report.current.consistency.available
    ? report.current.consistency.value
    : null;
  const loggedDaysLabel = `${report.current.loggedDays} logged ${report.current.loggedDays === 1 ? 'day' : 'days'}`;

  return (
    <View className="gap-3">
      <ReportingSectionHeading icon="momentum" title={periodLabel} />
      <AppCard elevated className="gap-3">
        <View className="flex-row gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              Logging streak
            </AppText>
            <AppText
              variant="number"
              className="text-[34px] leading-10 text-ink"
            >
              {streak.loggedDays} {streak.loggedDays === 1 ? 'day' : 'days'}
            </AppText>
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              Consistency
            </AppText>
            <AppText
              variant="number"
              className="text-[34px] leading-10 text-ink"
            >
              {consistency === null ? '—' : `${consistency.percentage}%`}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" className="text-muted">
          {loggedDaysLabel} of {report.current.eligibleDays} eligible days
        </AppText>
        <View
          accessible
          accessibilityLabel={`Consistency, ${consistency === null ? 'not available' : `${consistency.percentage}%`}`}
          className="h-2 overflow-hidden rounded-full bg-primary-soft"
        >
          <View
            className="h-full rounded-full"
            style={{
              width: `${consistency?.percentage ?? 0}%`,
              backgroundColor: '#76DBA0',
            }}
          />
        </View>
      </AppCard>
    </View>
  );
}

function PeriodInsight({ report }: { report: ReportsResponse }) {
  const loggedDelta = report.comparison.loggedDays?.delta;
  const proteinDelta = report.comparison.averageProteinGrams?.delta;
  const copy =
    loggedDelta !== undefined && loggedDelta < 0 && proteinDelta !== undefined
      ? 'You logged fewer days, but protein stayed close to your goal.'
      : loggedDelta !== undefined && loggedDelta > 0
        ? `You logged ${loggedDelta} more day${loggedDelta === 1 ? '' : 's'} in this period.`
        : 'Keep logging to make this period insight more useful.';

  return (
    <View
      accessible
      accessibilityLabel={copy}
      className="flex-row overflow-hidden rounded-[18px]"
      style={{ backgroundColor: '#FFF0F1' }}
    >
      <View style={{ width: 6, backgroundColor: '#EA1226' }} />
      <AppText variant="label" className="flex-1 px-3 py-3 text-ink">
        {copy}
      </AppText>
    </View>
  );
}

function WeightSummary({ report }: { report: ReportsResponse['current'] }) {
  if (!report.weight.available) return null;
  const weight = report.weight.value;
  return (
    <View className="gap-3">
      <ReportingSectionHeading icon="weight" title="Weight direction" compact />
      <AppCard elevated>
        <View className="flex-row gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              Current weight
            </AppText>
            <AppText
              variant="number"
              className="text-[24px] leading-8 text-ink"
            >
              {formatWeight(weight.latestWeightLb)}
            </AppText>
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <AppText variant="caption" className="text-muted">
              This period
            </AppText>
            <AppText
              variant="number"
              className="text-[24px] leading-8 text-ink"
            >
              {weight.direction === null ? '—' : weight.direction}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" className="self-end text-muted">
          {weight.direction === 'steady' || weight.direction === null
            ? 'No clear direction yet'
            : 'Direction recorded from weight logs'}
        </AppText>
      </AppCard>
    </View>
  );
}

export function InsightsReportContent({ report }: { report: ReportsResponse }) {
  const currentHasLogs = report.current.loggedDays > 0;
  const previousHasLogs = report.previousCompleted.loggedDays > 0;
  const setupComplete = report.goalDirection !== null;
  if (!currentHasLogs && !previousHasLogs) return null;

  return (
    <View className="gap-5">
      <CurrentWindowSummary report={report} />
      <PeriodInsight report={report} />
      <EnergyReportSummary report={report.current} title="Energy balance" />
      <MacroReportSummary
        report={report.current}
        setupComplete={setupComplete}
      />
      <HighlightedNutrientSummary
        report={report.current}
        setupComplete={setupComplete}
      />
      <EquivalentPeriodComparison report={report} />
      <WeightSummary report={report.current} />
      {report.trackingMode === 'complex' ? (
        <CompleteNutrientReport
          report={report.current}
          setupComplete={setupComplete}
        />
      ) : null}
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
            setupComplete={setupComplete}
          />
          <HighlightedNutrientSummary
            report={report.previousCompleted}
            title="Previous nutrient highlights"
            setupComplete={setupComplete}
          />
          {report.trackingMode === 'complex' ? (
            <CompleteNutrientReport
              report={report.previousCompleted}
              title="Previous complete nutrient report"
              setupComplete={setupComplete}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
