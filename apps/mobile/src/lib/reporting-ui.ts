import type {
  AdherenceResult,
  AcceptedCalorieRange,
  AverageCalorieStatus,
  ProgressResponse,
  ReportMode,
  ReportPeriod,
  ReportsResponse,
  ReportingNutrientDetail,
  ReportingNutrientGroup,
} from '@food-tracker/shared';
import { reportingNutrientGroupForCategory } from '@food-tracker/shared';

export function availableValue<T>(
  metric: { available: true; value: T } | { available: false },
): T | null {
  return metric.available ? metric.value : null;
}

export function streakEntryLabel(currentStreak: number): string {
  const days = Math.max(0, Math.round(currentStreak));
  return `${days} day${days === 1 ? '' : 's'} logged`;
}

function formatCalories(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} kcal`;
}

export function calorieHeroContext({
  caloriesConsumed,
  calorieTarget,
  caloriesRemaining,
  acceptedCalorieRange,
}: {
  caloriesConsumed: number;
  calorieTarget: number | null;
  caloriesRemaining: number | null;
  acceptedCalorieRange: AcceptedCalorieRange | null;
}): { amount: string; range: string; context: string } {
  const range =
    calorieTarget === null || acceptedCalorieRange === null
      ? '—'
      : `${formatCalories(acceptedCalorieRange.lowerCalories).replace(' kcal', '')}–${formatCalories(acceptedCalorieRange.upperCalories)}` +
        ' accepted range';
  const context =
    calorieTarget === null || caloriesRemaining === null
      ? '—'
      : caloriesRemaining < 0
        ? `${formatCalories(Math.abs(caloriesRemaining))} exceeded`
        : `${formatCalories(caloriesRemaining)} remaining`;

  return {
    amount: formatCalories(caloriesConsumed),
    range,
    context,
  };
}

export function weeklyMomentumDayFacts(
  report: Pick<ReportsResponse['current'], 'dailyBreakdown'>,
): ReportsResponse['current']['dailyBreakdown'] {
  return report.dailyBreakdown;
}

export function streakHeadline(loggedDays: number): string {
  return `${loggedDays}-day streak`;
}

export function streakSupportingCopy(
  input: ProgressResponse['currentStreak'],
): string {
  if (input.loggedDays === 0) return 'Log a meal today to start your streak.';
  if (input.spanDays > input.loggedDays) {
    return `${input.loggedDays} days logged across ${input.spanDays} days.`;
  }
  if (!input.todayLogged && input.todayOpen) {
    return 'Log today before the local day ends to continue.';
  }
  return `${input.loggedDays} days logged.`;
}

export function calorieAdherenceStatus(
  metric: AdherenceResult,
  goalDirection: ProgressResponse['goalDirection'],
): string | null {
  const value = availableValue(metric);
  if (value === null || goalDirection === null) return null;
  const ranges = {
    gain: [95, 115],
    maintain: [90, 110],
    lose: [85, 105],
  } as const;
  const [lower, upper] = ranges[goalDirection];
  if (value.percentage < lower) return 'Below target range';
  if (value.percentage > upper) return 'Above target range';
  return 'Within target range';
}

export function proteinAdherenceStatus(metric: AdherenceResult): string | null {
  const value = availableValue(metric);
  if (value === null) return null;
  return value.percentage >= 90 ? 'On target' : 'Below target';
}

export function nutrientKeysForMode(mode: ReportMode): string[] {
  if (mode === 'simple') return ['fiber', 'sugar', 'sodium'];
  return [];
}

export function nutrientDetailsForMode(
  report: Pick<ReportsResponse['current'], 'nutrientDetails'>,
  mode: ReportMode,
): Array<{ key: string; detail: ReportingNutrientDetail }> {
  const details = report.nutrientDetails ?? {};
  const keys =
    mode === 'simple'
      ? nutrientKeysForMode(mode)
      : Object.keys(details).sort((left, right) =>
          (details[left]?.displayName ?? left).localeCompare(
            details[right]?.displayName ?? right,
          ),
        );

  return keys.flatMap((key) => {
    const detail = details[key];
    return detail === undefined ? [] : [{ key, detail }];
  });
}

export function nutrientGroupForDetail(
  detail: ReportingNutrientDetail,
): ReportingNutrientGroup {
  return reportingNutrientGroupForCategory(detail.category);
}

export function nutrientGroupLabel(group: ReportingNutrientGroup): string {
  switch (group) {
    case 'general':
      return 'General and energy';
    case 'carbohydrate_fiber':
      return 'Carbohydrates and fiber';
    case 'lipids':
      return 'Fats and lipids';
    case 'protein_amino_acid':
      return 'Protein and amino acids';
    case 'vitamins':
      return 'Vitamins';
    case 'minerals':
      return 'Minerals';
    case 'other':
      return 'Other recorded nutrients';
  }
}

export function energyStatusLabel(status: AverageCalorieStatus): string {
  switch (status) {
    case 'no_data':
      return 'No logged energy yet';
    case 'no_target':
      return 'Target not set';
    case 'below_range':
      return 'Below target range';
    case 'within_range':
      return 'Within target range';
    case 'over_range':
      return 'Above target range';
  }
}

type ReportWindowKind = 'current' | 'previous' | 'equivalent';
type ReportBoundary = ReportsResponse['current']['boundaries'];

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function shortRange(startDate: string, endDate: string): string {
  return `${shortDate(startDate)} – ${shortDate(endDate)}`;
}

export function reportWindowTitle(
  period: ReportPeriod,
  kind: ReportWindowKind,
  boundary: ReportBoundary,
): string {
  const periodLabel = period === 'week' ? 'week' : 'month';
  const title =
    kind === 'current'
      ? `Current ${periodLabel} so far`
      : kind === 'equivalent'
        ? `Equivalent previous ${periodLabel}`
        : `Previous full ${periodLabel}`;
  const endDate =
    kind === 'current' ? boundary.elapsedThroughDate : boundary.endDate;
  return `${title} · ${shortRange(boundary.startDate, endDate)}`;
}

export function comparisonSentences(
  comparison: ReportsResponse['comparison'],
): string[] {
  const sentences: string[] = [];
  if (comparison.loggedDays !== undefined) {
    const delta = comparison.loggedDays.delta;
    sentences.push(
      delta === 0
        ? 'Logged the same number of days.'
        : `Logged ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} ${delta > 0 ? 'more' : 'fewer'}.`,
    );
  }
  if (comparison.consistency !== undefined) {
    sentences.push(
      `Consistency ${comparison.consistency.delta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(comparison.consistency.delta)} percentage points.`,
    );
  }
  if (comparison.averageProteinGrams !== undefined) {
    sentences.push(
      `Average protein ${comparison.averageProteinGrams.delta >= 0 ? 'increased' : 'decreased'} by ${Math.abs(comparison.averageProteinGrams.delta)} grams.`,
    );
  }
  return sentences;
}
