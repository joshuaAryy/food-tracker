import type {
  AdherenceResult,
  ProgressResponse,
  ReportMode,
  ReportsResponse,
} from '@food-tracker/shared';

export function availableValue<T>(
  metric: { available: true; value: T } | { available: false },
): T | null {
  return metric.available ? metric.value : null;
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
