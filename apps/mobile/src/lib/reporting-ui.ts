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
  ReportingGoal,
  TrackingMode,
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

function formatGrams(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} g`;
}

export function calorieHeroTargetLabel(calorieTarget: number | null): string {
  return calorieTarget === null || calorieTarget <= 0
    ? '—'
    : `${formatCalories(calorieTarget)} target`;
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
  const hasTarget = calorieTarget !== null && calorieTarget > 0;
  const range =
    !hasTarget || acceptedCalorieRange === null
      ? '—'
      : `${formatCalories(acceptedCalorieRange.lowerCalories).replace(' kcal', '')}–${formatCalories(acceptedCalorieRange.upperCalories)}` +
        ' accepted range';
  const context =
    !hasTarget || caloriesRemaining === null
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

export function weeklyMomentumFinalDay(
  report: Pick<ReportsResponse['current'], 'dailyBreakdown'>,
): ReportsResponse['current']['dailyBreakdown'][number] | null {
  return report.dailyBreakdown.at(-1) ?? null;
}

export function weeklyMomentumDayState(
  day: ReportsResponse['current']['dailyBreakdown'][number],
): { status: string; calories: string; protein: string } {
  return {
    status: day.logged ? 'Logged' : 'Not logged',
    calories: formatCalories(day.calories),
    protein: formatGrams(day.proteinGrams),
  };
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

type NutrientPercentageReport = {
  proteinTargetGrams?: number | null | undefined;
  proteinAdherence?: ReportsResponse['current']['proteinAdherence'] | undefined;
  nutrientDetails?: ReportsResponse['current']['nutrientDetails'] | undefined;
  reportingGoals?: ReportsResponse['current']['reportingGoals'] | undefined;
};

export type NutrientPresentationState =
  | 'no_goal'
  | 'not_recorded'
  | 'recorded'
  | 'setup_incomplete';

export type NutrientPresentation = {
  state: NutrientPresentationState;
  totalLabel: string;
  percentageLabel: string;
  statusLabel: string;
};

export function trackingModeLabel(mode: TrackingMode | ReportMode): string {
  return mode === 'simple' ? 'Simple' : 'Complex';
}

function nutrientGoal(
  key: string,
  report: NutrientPercentageReport,
  detail?: ReportingNutrientDetail | null,
) {
  return detail?.goal ?? report.reportingGoals?.[key];
}

function nutrientPercentage(
  key: string,
  average: number,
  report: NutrientPercentageReport,
  detail?: ReportingNutrientDetail | null,
): number | null {
  if (detail?.percentage !== null && detail?.percentage !== undefined) {
    return Number.isFinite(detail.percentage) ? detail.percentage : null;
  }

  if (key === 'protein' && report.proteinAdherence?.available) {
    return report.proteinAdherence.value.percentage;
  }

  const goal = nutrientGoal(key, report, detail);
  if (
    goal?.value === null ||
    goal?.value === undefined ||
    goal.value <= 0 ||
    !Number.isFinite(average)
  ) {
    return null;
  }
  return (average / goal.value) * 100;
}

export function nutrientGoalPercentageLabel(
  percentage: number | null,
  direction: ReportingGoal['direction'] = 'target',
  goalValue?: number | null,
): string {
  if (percentage === null || !Number.isFinite(percentage)) {
    if (goalValue === null || goalValue === undefined) {
      return 'Complete setup to see nutrient goals';
    }
    if (goalValue === 0 && direction === 'limit') {
      return 'Zero limit; track the recorded amount';
    }
    return 'No goal set';
  }
  const label = `${Math.round(percentage)}%`;
  return direction === 'limit' ? `${label} of limit` : label;
}

export function nutrientPercentageLabel({
  key,
  average,
  report,
}: {
  key: string;
  average: number;
  report: NutrientPercentageReport;
}): string {
  const goal = nutrientGoal(key, report, report.nutrientDetails?.[key]);
  return nutrientGoalPercentageLabel(
    nutrientPercentage(key, average, report, report.nutrientDetails?.[key]),
    goal?.direction,
  );
}

export function nutrientPercentageAccessibilityLabel({
  key,
  average,
  report,
}: {
  key: string;
  average: number;
  report: NutrientPercentageReport;
}): string {
  const label = nutrientPercentageLabel({ key, average, report });
  if (label.endsWith('of limit')) {
    return `${label}; lower is better`;
  }
  return label.endsWith('%')
    ? `${label} of the available nutrient target`
    : label;
}

function formatNutrientAmount(value: number, unit: string): string {
  return `${value.toLocaleString('en-US', {
    maximumFractionDigits: unit === 'mg' || unit === 'mcg' ? 0 : 1,
  })} ${unit}`;
}

export function nutrientRowCopy({
  detail,
}: {
  key: string;
  detail: ReportingNutrientDetail;
  report: NutrientPercentageReport;
}): string {
  return formatNutrientAmount(detail.total, detail.unit);
}

export function nutrientPresentation({
  key,
  detail,
  report,
  setupComplete = true,
}: {
  key: string;
  detail: ReportingNutrientDetail | null;
  report: NutrientPercentageReport;
  setupComplete?: boolean;
}): NutrientPresentation {
  if (detail === null) {
    const state = setupComplete ? 'not_recorded' : 'setup_incomplete';
    return {
      state,
      totalLabel:
        state === 'setup_incomplete' ? 'Setup incomplete' : 'Not recorded',
      percentageLabel:
        state === 'setup_incomplete'
          ? 'Complete setup to see nutrient goals'
          : 'Not recorded in this period',
      statusLabel:
        state === 'setup_incomplete'
          ? 'Complete setup to see nutrient goals'
          : 'Not recorded in this period',
    };
  }

  const goal = nutrientGoal(key, report, detail);
  const hasUsableGoal =
    goal?.value !== null &&
    goal?.value !== undefined &&
    Number.isFinite(goal.value) &&
    (goal.value > 0 || goal.direction === 'limit');
  const percentage = nutrientPercentage(
    key,
    detail.averagePerLoggedDay,
    report,
    detail,
  );
  const percentageLabel = nutrientGoalPercentageLabel(
    percentage,
    goal?.direction,
  );
  const state: NutrientPresentationState = !hasUsableGoal
    ? 'setup_incomplete'
    : 'recorded';
  const unavailableGoalLabel =
    goal?.direction === 'limit' && goal.value === 0
      ? 'Zero limit; track the recorded amount'
      : 'Complete setup to see nutrient goals';

  return {
    state,
    totalLabel: formatNutrientAmount(detail.total, detail.unit),
    percentageLabel:
      state === 'setup_incomplete' ? unavailableGoalLabel : percentageLabel,
    statusLabel:
      state === 'setup_incomplete' ? unavailableGoalLabel : percentageLabel,
  };
}

const highlightedNutrientKeys = [
  ['fiber', 'Fiber'],
  ['sugar', 'Sugar'],
  ['sodium', 'Sodium'],
] as const;

export function highlightedNutrientEntries(
  report: Pick<ReportsResponse['current'], 'nutrientDetails'>,
): Array<{
  key: string;
  displayName: string;
  detail: ReportingNutrientDetail | null;
}> {
  const details = report.nutrientDetails ?? {};
  return highlightedNutrientKeys.map(([key, displayName]) => ({
    key,
    displayName,
    detail: details[key] ?? null,
  }));
}

export function previousPeriodNoDataLabel(boundary: {
  startDate: string;
  endDate: string;
}): string {
  return `No logged data for ${compactShortRange(boundary.startDate, boundary.endDate)}`;
}

export function initialExpandedGroups(
  groups: ReportingNutrientGroup[],
): ReportingNutrientGroup[] {
  return [...groups];
}

export function toggleExpandedGroup(
  groups: ReportingNutrientGroup[],
  group: ReportingNutrientGroup,
): ReportingNutrientGroup[] {
  return groups.includes(group)
    ? groups.filter((current) => current !== group)
    : [...groups, group];
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

function compactShortRange(startDate: string, endDate: string): string {
  return `${shortDate(startDate)}–${shortDate(endDate)}`;
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
