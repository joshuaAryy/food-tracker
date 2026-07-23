import type {
  DashboardSummary,
  DailyNutrientTotals,
  ProgressResponse,
  ReportsResponse,
} from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { ErrorState } from './error-state';
import { ReportingIcon } from './reporting-icon';
import { ReportingSectionHeading } from './reporting-section-heading';
import {
  calorieHeroContext,
  calorieHeroTargetLabel,
  nutrientGoalPercentageLabel,
  weeklyMomentumDayState,
  weeklyMomentumFinalDay,
} from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatAmount(amount: number, unit: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: unit === 'mg' || unit === 'mcg' ? 0 : 1 })} ${unit}`;
}

export function ProgressCalorieHero({
  summary,
  weeklyReport,
}: {
  summary: DashboardSummary;
  weeklyReport: ReportsResponse | null;
}) {
  const target =
    summary.calorieTarget !== null && summary.calorieTarget > 0
      ? summary.calorieTarget
      : null;
  const range = weeklyReport?.current.acceptedCalorieRange ?? null;
  const lower = range?.lowerCalories ?? target;
  const upper = range?.upperCalories ?? target;
  const span =
    lower === null || upper === null
      ? null
      : Math.max(upper - lower, Math.round((target ?? upper) * 0.25));
  const minimum =
    lower === null || span === null ? 0 : Math.max(0, lower - span);
  const maximum =
    upper === null || span === null ? (target ?? 1) : upper + span;
  const marker =
    target === null || maximum <= minimum
      ? 0
      : clamp((summary.caloriesConsumed - minimum) / (maximum - minimum));
  const targetStart =
    lower === null || maximum <= minimum
      ? 0
      : clamp((lower - minimum) / (maximum - minimum));
  const targetWidth =
    lower === null || upper === null || maximum <= minimum
      ? 0
      : clamp((upper - lower) / (maximum - minimum));
  const calorieContext = calorieHeroContext({
    caloriesConsumed: summary.caloriesConsumed,
    calorieTarget: target,
    caloriesRemaining: summary.caloriesRemaining,
    acceptedCalorieRange: range,
  });
  const railLabel =
    calorieContext.range === '—'
      ? calorieHeroTargetLabel(target)
      : calorieContext.range;

  return (
    <View className="gap-3">
      <ReportingSectionHeading icon="energy" title="Today’s energy" />
      <AppCard elevated className="gap-3">
        <AppText
          variant="number"
          className="text-[44px] leading-[52px] text-ink tabular-nums"
        >
          {calorieContext.amount}
        </AppText>
        <AppText variant="caption" className="text-muted">
          {calorieContext.context}
        </AppText>
        {target === null ? (
          <AppText
            variant="caption"
            className="border-t border-line pt-3 text-muted"
          >
            {railLabel}
          </AppText>
        ) : (
          <View className="gap-2 border-t border-line pt-3">
            <View className="relative h-2 overflow-hidden rounded-full bg-primary-soft">
              {targetWidth > 0 ? (
                <View
                  className="absolute bottom-0 top-0 rounded-full"
                  style={{
                    left: `${targetStart * 100}%`,
                    width: `${targetWidth * 100}%`,
                    backgroundColor: colors.light.loggedProgress,
                  }}
                />
              ) : null}
              <View
                className="absolute -top-1 h-4 w-1.5 rounded-full bg-ink"
                style={{ left: `${marker * 100}%` }}
              />
            </View>
            <AppText variant="caption" className="text-muted">
              {railLabel}
            </AppText>
          </View>
        )}
      </AppCard>
    </View>
  );
}

function DailyNutrientBand({
  dailyNutrients,
}: {
  dailyNutrients: DailyNutrientTotals | null;
}) {
  const nutrients = dailyNutrients?.nutrients ?? {};
  const reportingGoals = dailyNutrients?.reportingGoals ?? {};
  const percentages = dailyNutrients?.percentages ?? {};
  const keys = ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const;
  const entries = keys.flatMap((key) => {
    const value = nutrients[key];
    return value === undefined ? [] : [{ key, value }];
  });
  return (
    <View className="gap-3">
      <ReportingSectionHeading icon="nutrients" title="Today’s nutrition" />
      <AppCard elevated>
        {entries.length === 0 ? (
          <AppText variant="caption" className="text-muted">
            Log food with nutrient details to see protein, carbohydrates, fat,
            fiber, sugar, and sodium here.
          </AppText>
        ) : (
          entries.map(({ key, value }) => (
            <View
              key={key}
              className="flex-row items-center justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0"
            >
              <View className="min-w-0 flex-1 gap-0.5">
                <AppText variant="label" className="text-ink">
                  {key === 'protein'
                    ? 'Protein priority'
                    : key === 'carbs'
                      ? 'Carbohydrates'
                      : key[0]?.toUpperCase() + key.slice(1)}
                </AppText>
                {reportingGoals[key] !== undefined ? (
                  <AppText variant="caption" className="text-muted">
                    {nutrientGoalPercentageLabel(
                      percentages[key] ?? null,
                      reportingGoals[key]?.direction,
                      reportingGoals[key]?.value,
                      { includeLimitContext: true },
                    )}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="label" className="text-ink tabular-nums">
                {formatAmount(value.amount, value.unit)}
              </AppText>
            </View>
          ))
        )}
      </AppCard>
    </View>
  );
}

export function ProgressReportingSummary({
  reporting,
  weeklyReport,
  dailyNutrients,
  weeklyReportError,
  dailyNutrientsError,
  onRetry,
  onReports,
}: {
  reporting: ProgressResponse;
  weeklyReport: ReportsResponse | null;
  dailyNutrients: DailyNutrientTotals | null;
  weeklyReportError: string | null;
  dailyNutrientsError: string | null;
  onRetry: () => void;
  onReports: () => void;
}) {
  const consistency = reporting.consistency7Days.available
    ? reporting.consistency7Days.value
    : null;
  const days = weeklyReport?.current.dailyBreakdown ?? [];
  const finalMomentumDay = weeklyMomentumFinalDay(
    weeklyReport?.current ?? { dailyBreakdown: [] },
  );
  const finalMomentumState =
    finalMomentumDay === null ? null : weeklyMomentumDayState(finalMomentumDay);

  return (
    <View className="gap-5 border-t border-line pt-6">
      {weeklyReportError === null ? null : (
        <ErrorState
          title="Target range detail is unavailable"
          message={weeklyReportError}
          onRetry={onRetry}
        />
      )}
      <View className="gap-3">
        <ReportingSectionHeading icon="momentum" title="Weekly momentum" />
        <AppCard elevated className="gap-3">
          <AppText variant="caption" className="text-muted">
            {consistency === null
              ? 'Keep logging to unlock a weekly consistency signal.'
              : `${consistency.loggedDays} of ${consistency.eligibleDays} eligible days logged`}
          </AppText>
          <View className="flex-row justify-between gap-2">
            {days.map((day) => (
              <View key={day.date} className="items-center gap-1">
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: day.logged
                      ? colors.light.loggedProgress
                      : colors.light.primarySoft,
                  }}
                >
                  <AppText variant="caption" className="text-[12px] text-ink">
                    {new Date(`${day.date}T12:00:00Z`).getUTCDate()}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
          {finalMomentumDay === null || finalMomentumState === null ? null : (
            <AppText variant="caption" className="border-t border-line pt-3">
              Most recent returned day ·{' '}
              <AppText
                variant="caption"
                style={{
                  color: finalMomentumDay.logged
                    ? '#14733D'
                    : colors.light.muted,
                }}
              >
                {finalMomentumState.status}
              </AppText>
            </AppText>
          )}
        </AppCard>
      </View>
      {dailyNutrientsError === null ? null : (
        <ErrorState
          title="Today’s nutrient detail is unavailable"
          message={dailyNutrientsError}
          onRetry={onRetry}
        />
      )}
      <DailyNutrientBand dailyNutrients={dailyNutrients} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open detailed reports in Insights"
        className="min-h-11 flex-row items-center gap-2 border-t border-line pt-4 active:opacity-70"
        onPress={onReports}
      >
        <View className="min-w-0 flex-1">
          <AppText variant="label" className="text-ink">
            View full reports
          </AppText>
        </View>
        <ReportingIcon name="report" size={24} />
      </Pressable>
    </View>
  );
}
