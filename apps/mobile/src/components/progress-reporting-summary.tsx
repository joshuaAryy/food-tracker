import type {
  DashboardSummary,
  DailyNutrientTotals,
  ProgressResponse,
  ReportsResponse,
} from '@food-tracker/shared';
import { ArrowRight, Beef, Flame, Sparkles } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import { ErrorState } from './error-state';
import {
  calorieHeroContext,
  calorieHeroTargetLabel,
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
    <View className="gap-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Flame color={colors.light.carbs} size={18} strokeWidth={2.2} />
          <AppText variant="heading" className="text-ink">
            Today’s energy
          </AppText>
        </View>
        <AppText variant="caption" className="text-muted">
          {summary.foodLogCount === 0 ? 'Not started' : 'In progress'}
        </AppText>
      </View>
      <View className="flex-row items-end justify-between gap-3">
        <View className="min-w-0 flex-1">
          <AppText
            variant="hero"
            className="text-[52px] leading-[56px] text-ink tabular-nums"
          >
            {calorieContext.amount}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {calorieContext.context}
          </AppText>
        </View>
      </View>
      {target === null ? (
        <AppText variant="caption" className="text-muted">
          {railLabel}
        </AppText>
      ) : (
        <View className="gap-2">
          <View className="relative h-3 overflow-hidden rounded-full bg-primary-soft">
            {targetWidth > 0 ? (
              <View
                className="absolute bottom-0 top-0 rounded-full bg-sage-soft"
                style={{
                  left: `${targetStart * 100}%`,
                  width: `${targetWidth * 100}%`,
                }}
              />
            ) : null}
            <View
              className="absolute -top-1 h-5 w-1.5 rounded-full bg-ink"
              style={{ left: `${marker * 100}%` }}
            />
          </View>
          <View className="flex-row justify-between gap-3">
            <AppText variant="caption" className="text-muted">
              {railLabel}
            </AppText>
          </View>
        </View>
      )}
    </View>
  );
}

function DailyNutrientBand({
  summary,
  dailyNutrients,
}: {
  summary: DashboardSummary;
  dailyNutrients: DailyNutrientTotals | null;
}) {
  const nutrients = dailyNutrients?.nutrients ?? {};
  const keys = ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const;
  const entries = keys.flatMap((key) => {
    const value = nutrients[key];
    return value === undefined ? [] : [{ key, value }];
  });
  if (entries.length === 0) {
    return (
      <View className="border-t border-line pt-5">
        <AppText variant="label" className="text-ink">
          Nutrition detail
        </AppText>
        <AppText variant="caption" className="mt-1 text-muted">
          Log food with nutrient details to see protein, carbohydrates, fat,
          fiber, sugar, and sodium here.
        </AppText>
      </View>
    );
  }

  return (
    <View className="border-t border-line pt-5">
      <View className="flex-row items-center gap-2">
        <Sparkles color={colors.light.ink} size={17} strokeWidth={2.2} />
        <AppText variant="heading" className="text-ink">
          Today’s nutrition
        </AppText>
      </View>
      <View className="mt-2">
        {entries.map(({ key, value }) => (
          <View
            key={key}
            className="flex-row items-center justify-between gap-4 border-t border-line py-3"
          >
            <View className="min-w-0 flex-1 gap-0.5">
              <AppText variant="label" className="text-ink">
                {key === 'protein'
                  ? 'Protein priority'
                  : key === 'carbs'
                    ? 'Carbohydrates'
                    : key[0]?.toUpperCase() + key.slice(1)}
              </AppText>
              {key === 'protein' &&
              summary.proteinTarget !== null &&
              summary.proteinTarget > 0 ? (
                <AppText variant="caption" className="text-muted">
                  of {Math.round(summary.proteinTarget)} g target
                </AppText>
              ) : null}
            </View>
            <AppText variant="label" className="text-ink tabular-nums">
              {formatAmount(value.amount, value.unit)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ProgressReportingSummary({
  summary,
  reporting,
  weeklyReport,
  dailyNutrients,
  weeklyReportError,
  dailyNutrientsError,
  onRetry,
  onReports,
}: {
  summary: DashboardSummary;
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
  const finalMomentumDay =
    weeklyReport === null ? null : weeklyMomentumFinalDay(weeklyReport.current);
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
      <View className="gap-3 border-t border-line pt-5">
        <View className="flex-row items-center gap-2">
          <Beef color={colors.light.sageDark} size={18} strokeWidth={2.2} />
          <AppText variant="heading" className="text-ink">
            Weekly momentum
          </AppText>
        </View>
        {consistency === null ? (
          <AppText variant="caption" className="text-muted">
            Keep logging to unlock a weekly consistency signal.
          </AppText>
        ) : (
          <AppText variant="caption" className="text-muted">
            {consistency.loggedDays} of {consistency.eligibleDays} eligible days
            logged.
          </AppText>
        )}
        {finalMomentumDay === null || finalMomentumState === null ? null : (
          <View className="gap-2 border-t border-line pt-3">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <AppText variant="label" className="text-ink">
                  {new Intl.DateTimeFormat('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${finalMomentumDay.date}T12:00:00Z`))}
                </AppText>
                <AppText variant="caption" className="text-muted">
                  Most recent returned day ·{' '}
                  <AppText
                    variant="caption"
                    style={{
                      color: finalMomentumDay.logged
                        ? colors.light.loggedProgress
                        : colors.light.muted,
                    }}
                  >
                    {finalMomentumState.status}
                  </AppText>
                </AppText>
              </View>
            </View>
            <View className="flex-row items-center justify-between gap-3">
              <AppText variant="caption" className="text-muted">
                Calories
              </AppText>
              <AppText variant="label" className="text-ink tabular-nums">
                {finalMomentumState.calories}
              </AppText>
            </View>
            <View className="flex-row items-center justify-between gap-3">
              <AppText variant="caption" className="text-muted">
                Protein
              </AppText>
              <AppText variant="label" className="text-ink tabular-nums">
                {finalMomentumState.protein}
              </AppText>
            </View>
          </View>
        )}
      </View>
      {dailyNutrientsError === null ? null : (
        <ErrorState
          title="Today’s nutrient detail is unavailable"
          message={dailyNutrientsError}
          onRetry={onRetry}
        />
      )}
      <DailyNutrientBand summary={summary} dailyNutrients={dailyNutrients} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open detailed reports in Insights"
        className="min-h-11 flex-row items-center justify-between border-t border-line pt-4 active:opacity-70"
        onPress={onReports}
      >
        <View className="min-w-0 flex-1">
          <AppText variant="label" className="text-ink">
            See deeper reports
          </AppText>
          <AppText variant="caption" className="text-muted">
            Compare periods and explore recorded nutrients.
          </AppText>
        </View>
        <ArrowRight color={colors.light.ink} size={18} strokeWidth={2.1} />
      </Pressable>
    </View>
  );
}
