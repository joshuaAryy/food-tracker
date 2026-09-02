import {
  DEFAULT_TIMEZONE,
  NUTRIENT_CATALOG,
  reportingNutrientCatalogEntry,
  type AdherenceResult,
  type AverageCalorieStatus,
  type ProgressResponse,
  type ReportPeriod,
  reportingGoalForKey,
  type ReportingNutrientDetails,
  type ReportingGoals,
  type ReportingGoal,
  type ReportsResponse,
  type ReportingMetricReason,
  type WeightResult,
  type NutrientKey,
} from '@food-tracker/shared';
import { prisma } from '../../../lib/prisma.js';
import {
  addLocalDays,
  localDate,
  localDateDifference,
} from '../../../lib/dates.js';
import { roundTo } from '../../../lib/serializers.js';
import {
  calculateConsistency,
  calculateStreak,
  type ReportingDay,
} from './facts.js';
import { acceptedCalorieRange } from './calendar-facts.js';
import {
  comparisonWindows,
  periodBoundaries,
  type DateBoundary,
} from './periods.js';
import { resolveUserNutritionTargets } from '../../nutritionTargets/service.js';
import { resolveUserReportingGoals } from '../../nutritionTargets/reporting-adapter.js';
import { isDriDataComparable } from '../../nutritionTargets/dri-reference.js';

type Metric<T> =
  | { available: true; value: T }
  | { available: false; reason: ReportingMetricReason };

type ReportFoodLog = {
  loggedAt: Date;
  calories: number;
  protein: { toNumber(): number };
  carbs: { toNumber(): number } | null;
  fat: { toNumber(): number } | null;
  fiber: { toNumber(): number } | null;
  sugar: { toNumber(): number } | null;
  sodium: number | null;
  nutrients: Array<{
    nutrientKey: string;
    amount: { toNumber(): number };
    unit: string;
  }>;
  foodItem?: { sourceProvider: string | null } | null;
};

type ReportWeightLog = {
  weightLb: { toNumber(): number };
  loggedAt: Date;
};

interface ReportWindowFacts {
  boundary: DateBoundary & { elapsedThroughDate: string };
  days: ReportingDay[];
  eligibleDays: number;
  loggedDays: number;
  consistency: Metric<{
    eligibleDays: number;
    loggedDays: number;
    percentage: number;
  }>;
  calorieAdherence: AdherenceResult;
  proteinAdherence: AdherenceResult;
  averageCalories: number;
  averageProteinGrams: number;
  nutrients: Record<string, number>;
  nutrientDetails: ReportingNutrientDetails;
  reportingGoals: ReportingGoals;
  calorieTarget: number | null;
  proteinTargetGrams: number | null;
  acceptedCalorieRange: ReturnType<typeof acceptedCalorieRange>;
  averageCalorieStatus: AverageCalorieStatus;
  weight: WeightResult;
  dailyBreakdown: Array<{
    date: string;
    logged: boolean;
    calories: number;
    proteinGrams: number;
  }>;
}

const NUTRIENT_COLUMNS = ['fiber', 'sugar', 'sodium'] as const;

function metricUnavailable(reason: ReportingMetricReason): {
  available: false;
  reason: ReportingMetricReason;
} {
  return { available: false, reason };
}

function datesInWindow(window: DateBoundary): string[] {
  const totalDays = localDateDifference(window.endDate, window.startDate) + 1;
  return Array.from({ length: Math.max(0, totalDays) }, (_, index) =>
    addLocalDays(window.startDate, index),
  );
}

function localDatesForLogs(
  logs: ReportFoodLog[],
  timezone: string,
): Set<string> {
  return new Set(logs.map((log) => localDate(log.loggedAt, timezone)));
}

function totalsByDay(
  logs: ReportFoodLog[],
  timezone: string,
): Map<string, { calories: number; protein: number }> {
  const totals = new Map<string, { calories: number; protein: number }>();
  for (const log of logs) {
    const date = localDate(log.loggedAt, timezone);
    const current = totals.get(date) ?? { calories: 0, protein: 0 };
    current.calories += log.calories;
    current.protein += log.protein.toNumber();
    totals.set(date, current);
  }
  return totals;
}

function dailyAdherence(
  logs: ReportFoodLog[],
  timezone: string,
  target: number | null,
  threshold: number,
  qualifies: (amount: number, target: number) => boolean,
): AdherenceResult {
  const totals = totalsByDay(logs, timezone);
  if (target === null) return metricUnavailable('missing_target');
  if (totals.size < threshold) return metricUnavailable('minimum_logged_days');

  const amounts = [...totals.values()];
  const total = amounts.reduce((sum, value) => sum + value.calories, 0);
  const adherentDays = amounts.filter((value) =>
    qualifies(value.calories, target),
  ).length;

  return {
    available: true,
    value: {
      averageAmount: roundTo(total / amounts.length, 1),
      targetAmount: target,
      percentage: roundTo((total / amounts.length / target) * 100, 1),
      adherentDays,
      loggedDays: amounts.length,
    },
  };
}

function proteinAdherence(
  logs: ReportFoodLog[],
  timezone: string,
  target: number | null,
  threshold: number,
): AdherenceResult {
  const totals = totalsByDay(logs, timezone);
  if (target === null) return metricUnavailable('missing_target');
  if (totals.size < threshold) return metricUnavailable('minimum_logged_days');

  const amounts = [...totals.values()];
  const total = amounts.reduce((sum, value) => sum + value.protein, 0);
  const adherentDays = amounts.filter(
    (value) => value.protein / target >= 0.9,
  ).length;
  return {
    available: true,
    value: {
      averageAmount: roundTo(total / amounts.length, 1),
      targetAmount: target,
      percentage: roundTo((total / amounts.length / target) * 100, 1),
      adherentDays,
      loggedDays: amounts.length,
    },
  };
}

function calorieAdherence(
  logs: ReportFoodLog[],
  timezone: string,
  target: number | null,
  goalType: 'lose' | 'maintain' | 'gain' | null,
  threshold: number,
): AdherenceResult {
  const ranges = {
    gain: [0.95, 1.15],
    maintain: [0.9, 1.1],
    lose: [0.85, 1.05],
  } as const;
  if (goalType === null) return metricUnavailable('missing_goal');
  const range = ranges[goalType];
  return dailyAdherence(
    logs,
    timezone,
    target,
    threshold,
    (amount, dailyTarget) =>
      amount >= dailyTarget * range[0] && amount <= dailyTarget * range[1],
  );
}

interface NutrientAccumulator {
  total: number;
  dates: Set<string>;
  unit: string;
}

function nutrientReportFacts(
  logs: ReportFoodLog[],
  timezone: string,
  mode: 'simple' | 'complex',
  reportingGoals: ReportingGoals,
  eligibleDays: number,
): {
  nutrients: Record<string, number>;
  nutrientDetails: ReportingNutrientDetails;
} {
  const totals = new Map<string, NutrientAccumulator>();
  const allowed =
    mode === 'simple'
      ? new Set(['calories', 'protein', 'carbs', 'fat', ...NUTRIENT_COLUMNS])
      : null;
  const add = (
    key: string,
    amount: number | null,
    unit: string,
    date: string,
  ) => {
    if (amount === null || (allowed !== null && !allowed.has(key))) return;
    const entry = reportingNutrientCatalogEntry(key);
    if (entry === null) return;
    const current = totals.get(key) ?? {
      total: 0,
      dates: new Set<string>(),
      unit,
    };
    current.total += amount;
    current.dates.add(date);
    totals.set(key, current);
  };

  for (const log of logs) {
    const date = localDate(log.loggedAt, timezone);
    add('calories', log.calories, NUTRIENT_CATALOG.calories.defaultUnit, date);
    add(
      'protein',
      log.protein.toNumber(),
      NUTRIENT_CATALOG.protein.defaultUnit,
      date,
    );
    add(
      'carbs',
      log.carbs?.toNumber() ?? null,
      NUTRIENT_CATALOG.carbs.defaultUnit,
      date,
    );
    add(
      'fat',
      log.fat?.toNumber() ?? null,
      NUTRIENT_CATALOG.fat.defaultUnit,
      date,
    );
    add(
      'fiber',
      log.fiber?.toNumber() ?? null,
      NUTRIENT_CATALOG.fiber.defaultUnit,
      date,
    );
    add(
      'sugar',
      log.sugar?.toNumber() ?? null,
      NUTRIENT_CATALOG.sugar.defaultUnit,
      date,
    );
    add('sodium', log.sodium, NUTRIENT_CATALOG.sodium.defaultUnit, date);
    for (const nutrient of log.nutrients) {
      if (nutrient.nutrientKey === 'water') continue;
      if (
        !isDriDataComparable(
          nutrient.nutrientKey as NutrientKey,
          log.foodItem?.sourceProvider,
        )
      )
        continue;
      add(
        nutrient.nutrientKey,
        nutrient.amount.toNumber(),
        nutrient.unit,
        date,
      );
    }
  }

  const nutrientDetails = Object.fromEntries(
    [...totals.entries()].map(([key, value]) => {
      const entry = reportingNutrientCatalogEntry(key);
      if (entry === null) return [key, undefined];
      const recordedDayCount = value.dates.size;
      const precision = value.unit === 'mg' || value.unit === 'mcg' ? 0 : 1;
      const resolvedGoal =
        reportingGoalForKey(
          reportingGoals,
          key as keyof typeof NUTRIENT_CATALOG,
        ) ?? missingReportingGoal(value.unit);
      const periodGoal =
        resolvedGoal.value !== null && eligibleDays > 0
          ? roundTo(resolvedGoal.value * eligibleDays, precision)
          : null;
      const percentage =
        periodGoal !== null && periodGoal > 0
          ? roundTo((value.total / periodGoal) * 100, 1)
          : null;
      const status =
        periodGoal === null || percentage === null
          ? 'unknown'
          : resolvedGoal.direction === 'limit'
            ? value.total <= periodGoal
              ? 'within_limit'
              : 'above_limit'
            : resolvedGoal.direction === 'minimum'
              ? value.total < periodGoal
                ? 'below_minimum'
                : 'meets_minimum'
              : value.total < periodGoal
                ? 'below_target'
                : value.total > periodGoal
                  ? 'above_target'
                  : 'meets_target';
      return [
        key,
        {
          displayName: entry.displayName,
          category: entry.category,
          total: roundTo(value.total, precision),
          averagePerLoggedDay: roundTo(
            value.total / recordedDayCount,
            precision,
          ),
          unit: value.unit,
          recordedDayCount,
          goal: resolvedGoal,
          periodGoal,
          percentage,
          status,
        },
      ];
    }),
  ) as ReportingNutrientDetails;
  const nutrients = Object.fromEntries(
    Object.entries(nutrientDetails).map(([key, value]) => [
      key,
      value.averagePerLoggedDay,
    ]),
  );
  return { nutrients, nutrientDetails };
}

function missingReportingGoal(unit: string): ReportingGoal {
  const normalizedUnit =
    unit === 'kcal' || unit === 'g' || unit === 'mg' || unit === 'mcg'
      ? unit
      : 'g';
  return {
    value: null,
    unit: normalizedUnit,
    direction: 'target',
    source: 'missing',
  };
}

function averageCalorieStatus(
  averageCalories: number,
  loggedDays: number,
  goalType: 'lose' | 'maintain' | 'gain' | null,
  targetCalories: number | null,
): AverageCalorieStatus {
  if (loggedDays === 0) return 'no_data';
  const range = acceptedCalorieRange(goalType, targetCalories);
  if (range === null) return 'no_target';
  if (averageCalories < range.lowerCalories) return 'below_range';
  if (averageCalories > range.upperCalories) return 'over_range';
  return 'within_range';
}

function weightFacts(
  logs: ReportWeightLog[],
  goalTarget: number | null,
  baseline: number | null,
): WeightResult {
  if (logs.length === 0) return metricUnavailable('no_data');
  const ordered = [...logs].sort(
    (a, b) => a.loggedAt.getTime() - b.loggedAt.getTime(),
  );
  const latest = ordered.at(-1);
  if (latest === undefined) return metricUnavailable('no_data');
  const latestWeightLb = latest.weightLb.toNumber();
  const first = ordered[0];
  const changeLb =
    first === undefined || ordered.length < 2
      ? null
      : roundTo(latestWeightLb - first.weightLb.toNumber(), 1);
  let trendRateLbPerWeek: number | null = null;
  if (ordered.length >= 3 && first !== undefined) {
    const x0 = first.loggedAt.getTime();
    const points = ordered.map((entry) => ({
      x: (entry.loggedAt.getTime() - x0) / 86_400_000,
      y: entry.weightLb.toNumber(),
    }));
    const xMean =
      points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const yMean =
      points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const denominator = points.reduce(
      (sum, point) => sum + (point.x - xMean) ** 2,
      0,
    );
    if (denominator > 0) {
      const slopePerDay =
        points.reduce(
          (sum, point) => sum + (point.x - xMean) * (point.y - yMean),
          0,
        ) / denominator;
      trendRateLbPerWeek = roundTo(slopePerDay * 7, 2);
    }
  }
  const directionValue = trendRateLbPerWeek ?? changeLb;
  const direction =
    directionValue === null || Math.abs(directionValue) < 0.1
      ? 'steady'
      : directionValue > 0
        ? 'gaining'
        : 'losing';
  const progressFromBaselineLb =
    baseline === null ? null : roundTo(latestWeightLb - baseline, 1);
  const denominator =
    baseline === null || goalTarget === null ? null : goalTarget - baseline;
  const progress =
    baseline === null || denominator === null
      ? null
      : ((latestWeightLb - baseline) / denominator) * 100;
  const progressToTargetPercent =
    denominator === null || denominator === 0
      ? null
      : roundTo(Math.max(0, Math.min(100, progress ?? 0)), 1);

  return {
    available: true,
    value: {
      latestWeightLb,
      latestLoggedAt: latest.loggedAt.toISOString(),
      changeLb,
      direction,
      trendRateLbPerWeek,
      targetWeightLb: goalTarget,
      progressFromBaselineLb,
      progressToTargetPercent,
    },
  };
}

function periodWindow(
  boundary: DateBoundary & { elapsedThroughDate: string },
  effectiveEndDate: string,
): DateBoundary {
  return { startDate: boundary.startDate, endDate: effectiveEndDate };
}

function buildWindowFacts(input: {
  boundary: DateBoundary & { elapsedThroughDate: string };
  logs: ReportFoodLog[];
  weightLogs: ReportWeightLog[];
  timezone: string;
  goalType: 'lose' | 'maintain' | 'gain' | null;
  targetCalories: number | null;
  targetProtein: number | null;
  targetWeight: number | null;
  baselineWeight: number | null;
  mode: 'simple' | 'complex';
  reportingGoals: ReportingGoals;
  firstLoggedDate: string | undefined;
}): ReportWindowFacts {
  const window = periodWindow(
    input.boundary,
    input.boundary.elapsedThroughDate,
  );
  const dates = datesInWindow(window);
  const loggedDates = localDatesForLogs(input.logs, input.timezone);
  const days = dates.map((date) => ({ date, logged: loggedDates.has(date) }));
  const consistency = calculateConsistency(days, window, input.firstLoggedDate);
  const loggedDays = loggedDates.size;
  const totals = totalsByDay(input.logs, input.timezone);
  const dailyBreakdown = days.map((day) => ({
    date: day.date,
    logged: day.logged,
    calories: roundTo(totals.get(day.date)?.calories ?? 0, 1),
    proteinGrams: roundTo(totals.get(day.date)?.protein ?? 0, 1),
  }));
  const averageCalories =
    loggedDays === 0
      ? 0
      : roundTo(
          [...totals.values()].reduce((sum, value) => sum + value.calories, 0) /
            loggedDays,
          1,
        );
  const averageProteinGrams =
    loggedDays === 0
      ? 0
      : roundTo(
          [...totals.values()].reduce((sum, value) => sum + value.protein, 0) /
            loggedDays,
          1,
        );
  const windowWeightLogs = input.weightLogs.filter((log) => {
    const date = localDate(log.loggedAt, input.timezone);
    return date >= window.startDate && date <= window.endDate;
  });
  const nutrientFacts = nutrientReportFacts(
    input.logs,
    input.timezone,
    input.mode,
    input.reportingGoals,
    consistency.eligibleDays,
  );

  return {
    boundary: input.boundary,
    days,
    eligibleDays: consistency.eligibleDays,
    loggedDays,
    consistency:
      consistency.eligibleDays <
      (window.endDate === input.boundary.elapsedThroughDate
        ? window.endDate > addLocalDays(window.startDate, 6)
          ? 7
          : 3
        : 1)
        ? metricUnavailable('minimum_logged_days')
        : { available: true, value: consistency },
    calorieAdherence: calorieAdherence(
      input.logs,
      input.timezone,
      input.targetCalories,
      input.goalType,
      window.endDate === input.boundary.elapsedThroughDate ? 3 : 7,
    ),
    proteinAdherence: proteinAdherence(
      input.logs,
      input.timezone,
      input.targetProtein,
      window.endDate === input.boundary.elapsedThroughDate ? 3 : 7,
    ),
    averageCalories,
    averageProteinGrams,
    nutrients: nutrientFacts.nutrients,
    nutrientDetails: nutrientFacts.nutrientDetails,
    reportingGoals: input.reportingGoals,
    calorieTarget: input.targetCalories,
    proteinTargetGrams: input.targetProtein,
    acceptedCalorieRange: acceptedCalorieRange(
      input.goalType,
      input.targetCalories,
    ),
    averageCalorieStatus: averageCalorieStatus(
      averageCalories,
      loggedDays,
      input.goalType,
      input.targetCalories,
    ),
    dailyBreakdown,
    weight: weightFacts(
      windowWeightLogs,
      input.targetWeight,
      input.baselineWeight,
    ),
  };
}

function comparisonMetric(current: number, previous: number) {
  return { current, previous, delta: roundTo(current - previous, 1) };
}

export async function computeReports(
  userId: string,
  period: ReportPeriod,
  requestedDate?: string,
  now = new Date(),
): Promise<ReportsResponse> {
  const [
    profile,
    goal,
    preferences,
    foodLogs,
    weightLogs,
    effectiveTargets,
    reportingGoals,
  ] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.trackingPreference.findUnique({
      where: { userId },
      select: { mode: true },
    }),
    prisma.foodLog.findMany({
      where: { userId },
      select: {
        loggedAt: true,
        foodItem: { select: { sourceProvider: true } },
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        fiber: true,
        sugar: true,
        sodium: true,
        nutrients: { select: { nutrientKey: true, amount: true, unit: true } },
      },
      orderBy: { loggedAt: 'asc' },
    }),
    prisma.weightLog.findMany({
      where: { userId },
      select: { weightLb: true, loggedAt: true },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
    resolveUserNutritionTargets(userId, now),
    resolveUserReportingGoals(userId, now),
  ]);
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const today = requestedDate ?? localDate(now, timezone);
  const targetValue = (key: keyof typeof effectiveTargets): number | null =>
    effectiveTargets[key]?.effectiveValue ?? null;
  const boundaries = periodBoundaries(period, today);
  const comparisons = comparisonWindows(period, today);
  const firstLoggedDate =
    foodLogs[0] === undefined
      ? undefined
      : localDate(foodLogs[0].loggedAt, timezone);
  const serializedFoodLogs = foodLogs as ReportFoodLog[];
  const serializedWeightLogs = weightLogs as ReportWeightLog[];
  const currentLogs = serializedFoodLogs.filter((log) => {
    const date = localDate(log.loggedAt, timezone);
    return (
      date >= boundaries.current.startDate &&
      date <= boundaries.current.elapsedThroughDate
    );
  });
  const previousLogs = serializedFoodLogs.filter((log) => {
    const date = localDate(log.loggedAt, timezone);
    return (
      date >= boundaries.previousCompleted.startDate &&
      date <= boundaries.previousCompleted.endDate
    );
  });
  const previousEquivalentLogs = serializedFoodLogs.filter((log) => {
    const date = localDate(log.loggedAt, timezone);
    return (
      date >= comparisons.previousEquivalent.startDate &&
      date <= comparisons.previousEquivalent.endDate
    );
  });
  const current = buildWindowFacts({
    boundary: boundaries.current,
    logs: currentLogs,
    weightLogs: serializedWeightLogs,
    timezone,
    goalType: goal?.goalType ?? null,
    targetCalories: targetValue('calories'),
    targetProtein: targetValue('protein'),
    targetWeight: goal?.targetWeightLb?.toNumber() ?? null,
    baselineWeight: serializedWeightLogs[0]?.weightLb.toNumber() ?? null,
    mode: preferences?.mode ?? 'simple',
    reportingGoals,
    firstLoggedDate,
  });
  const previousCompleted = buildWindowFacts({
    boundary: boundaries.previousCompleted,
    logs: previousLogs,
    weightLogs: serializedWeightLogs,
    timezone,
    goalType: goal?.goalType ?? null,
    targetCalories: targetValue('calories'),
    targetProtein: targetValue('protein'),
    targetWeight: goal?.targetWeightLb?.toNumber() ?? null,
    baselineWeight: serializedWeightLogs[0]?.weightLb.toNumber() ?? null,
    mode: preferences?.mode ?? 'simple',
    reportingGoals,
    firstLoggedDate,
  });
  const equivalent = buildWindowFacts({
    boundary: {
      ...boundaries.previousCompleted,
      ...comparisons.previousEquivalent,
      elapsedThroughDate: comparisons.previousEquivalent.endDate,
    },
    logs: previousEquivalentLogs,
    weightLogs: serializedWeightLogs,
    timezone,
    goalType: goal?.goalType ?? null,
    targetCalories: targetValue('calories'),
    targetProtein: targetValue('protein'),
    targetWeight: goal?.targetWeightLb?.toNumber() ?? null,
    baselineWeight: serializedWeightLogs[0]?.weightLb.toNumber() ?? null,
    mode: preferences?.mode ?? 'simple',
    reportingGoals,
    firstLoggedDate,
  });

  const streakFacts = calculateStreak(
    serializedFoodLogs
      .map((log) => localDate(log.loggedAt, timezone))
      .filter((date) => date <= today)
      .map((date) => ({ date, logged: true })),
    today,
  );
  const comparison: ReportsResponse['comparison'] = {
    currentBoundary: comparisons.current,
    previousEquivalentBoundary: comparisons.previousEquivalent,
  };
  if (current.loggedDays >= 1 && equivalent.loggedDays >= 1)
    comparison.loggedDays = comparisonMetric(
      current.loggedDays,
      equivalent.loggedDays,
    );
  if (current.consistency.available && equivalent.consistency.available)
    comparison.consistency = comparisonMetric(
      current.consistency.value.percentage,
      equivalent.consistency.value.percentage,
    );
  const comparisonThreshold = period === 'week' ? 3 : 7;
  if (
    current.loggedDays >= comparisonThreshold &&
    equivalent.loggedDays >= comparisonThreshold
  ) {
    comparison.averageCalories = comparisonMetric(
      current.averageCalories,
      equivalent.averageCalories,
    );
    comparison.averageProteinGrams = comparisonMetric(
      current.averageProteinGrams,
      equivalent.averageProteinGrams,
    );
  }
  if (
    current.calorieAdherence.available &&
    equivalent.calorieAdherence.available
  )
    comparison.calorieAdherence = comparisonMetric(
      current.calorieAdherence.value.percentage,
      equivalent.calorieAdherence.value.percentage,
    );
  if (
    current.proteinAdherence.available &&
    equivalent.proteinAdherence.available
  )
    comparison.proteinAdherence = comparisonMetric(
      current.proteinAdherence.value.percentage,
      equivalent.proteinAdherence.value.percentage,
    );
  if (
    current.weight.available &&
    equivalent.weight.available &&
    current.weight.value.changeLb !== null &&
    equivalent.weight.value.changeLb !== null
  )
    comparison.weightChangeLb = comparisonMetric(
      current.weight.value.changeLb,
      equivalent.weight.value.changeLb,
    );
  if (
    current.weight.available &&
    equivalent.weight.available &&
    current.weight.value.trendRateLbPerWeek !== null &&
    equivalent.weight.value.trendRateLbPerWeek !== null
  )
    comparison.weightTrendRateLbPerWeek = comparisonMetric(
      current.weight.value.trendRateLbPerWeek,
      equivalent.weight.value.trendRateLbPerWeek,
    );

  return {
    period,
    timezone,
    trackingMode: preferences?.mode ?? 'simple',
    goalDirection: goal?.goalType ?? null,
    current: {
      boundaries: boundaries.current,
      streak: {
        loggedDays: streakFacts.currentLoggedDays,
        spanDays: streakFacts.currentSpanDays,
        longestLoggedDays: streakFacts.longestLoggedDays,
        graceUsed: streakFacts.graceUsed,
        graceDate: streakFacts.graceDate,
        todayLogged: streakFacts.todayLogged,
        todayOpen: streakFacts.todayOpen,
      },
      dailyBreakdown: current.dailyBreakdown,
      eligibleDays: current.eligibleDays,
      loggedDays: current.loggedDays,
      consistency: current.consistency,
      calorieAdherence: current.calorieAdherence,
      proteinAdherence: current.proteinAdherence,
      averageCalories: current.averageCalories,
      averageProteinGrams: current.averageProteinGrams,
      weight: current.weight,
      nutrients: current.nutrients,
      nutrientDetails: current.nutrientDetails,
      reportingGoals: current.reportingGoals,
      calorieTarget: current.calorieTarget,
      proteinTargetGrams: current.proteinTargetGrams,
      acceptedCalorieRange: current.acceptedCalorieRange,
      averageCalorieStatus: current.averageCalorieStatus,
    },
    previousCompleted: {
      boundaries: boundaries.previousCompleted,
      dailyBreakdown: previousCompleted.dailyBreakdown,
      eligibleDays: previousCompleted.eligibleDays,
      loggedDays: previousCompleted.loggedDays,
      consistency: previousCompleted.consistency,
      calorieAdherence: previousCompleted.calorieAdherence,
      proteinAdherence: previousCompleted.proteinAdherence,
      averageCalories: previousCompleted.averageCalories,
      averageProteinGrams: previousCompleted.averageProteinGrams,
      weight: previousCompleted.weight,
      nutrients: previousCompleted.nutrients,
      nutrientDetails: previousCompleted.nutrientDetails,
      reportingGoals: previousCompleted.reportingGoals,
      calorieTarget: previousCompleted.calorieTarget,
      proteinTargetGrams: previousCompleted.proteinTargetGrams,
      acceptedCalorieRange: previousCompleted.acceptedCalorieRange,
      averageCalorieStatus: previousCompleted.averageCalorieStatus,
    },
    comparison,
  };
}

export async function computeProgress(
  userId: string,
  requestedDate?: string,
  now = new Date(),
): Promise<ProgressResponse> {
  const [profile, preferences, goal, foodLogs, weightLogs, effectiveTargets] =
    await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId },
        select: { timezone: true },
      }),
      prisma.trackingPreference.findUnique({
        where: { userId },
        select: { mode: true },
      }),
      prisma.userGoal.findUnique({ where: { userId } }),
      prisma.foodLog.findMany({
        where: { userId },
        select: {
          loggedAt: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          fiber: true,
          sugar: true,
          sodium: true,
          nutrients: {
            select: { nutrientKey: true, amount: true, unit: true },
          },
        },
      }),
      prisma.weightLog.findMany({
        where: { userId },
        select: { weightLb: true, loggedAt: true },
        orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      resolveUserNutritionTargets(userId, now),
    ]);
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const today = requestedDate ?? localDate(now, timezone);
  const targetValue = (key: keyof typeof effectiveTargets): number | null =>
    effectiveTargets[key]?.effectiveValue ?? null;
  const serializedFoodLogs = foodLogs as ReportFoodLog[];
  const serializedWeightLogs = weightLogs as ReportWeightLog[];
  const foodDates = [
    ...new Set(
      serializedFoodLogs.map((log) => localDate(log.loggedAt, timezone)),
    ),
  ]
    .filter((date) => date <= today)
    .sort();
  const firstDate = foodDates[0];
  const dayList = Array.from({ length: 30 }, (_, index) => {
    const date = addLocalDays(today, -29 + index);
    return { date, logged: foodDates.includes(date) };
  });
  const streak = calculateStreak(
    foodDates.map((date) => ({ date, logged: true })),
    today,
  );
  const consistency7 = calculateConsistency(
    dayList.slice(-7),
    { startDate: addLocalDays(today, -6), endDate: today },
    firstDate,
  );
  const consistency30 = calculateConsistency(
    dayList,
    { startDate: addLocalDays(today, -29), endDate: today },
    firstDate,
  );
  const last7Logs = serializedFoodLogs.filter((log) => {
    const date = localDate(log.loggedAt, timezone);
    return date >= addLocalDays(today, -6) && date <= today;
  });
  const weekCalorie = calorieAdherence(
    last7Logs,
    timezone,
    targetValue('calories'),
    goal?.goalType ?? null,
    3,
  );
  const weekProtein = proteinAdherence(
    last7Logs,
    timezone,
    targetValue('protein'),
    3,
  );
  const weight = weightFacts(
    serializedWeightLogs,
    goal?.targetWeightLb?.toNumber() ?? null,
    serializedWeightLogs[0]?.weightLb.toNumber() ?? null,
  );
  return {
    timezone,
    trackingMode: preferences?.mode ?? 'simple',
    goalDirection: goal?.goalType ?? null,
    currentStreak: {
      loggedDays: streak.currentLoggedDays,
      spanDays: streak.currentSpanDays,
      longestLoggedDays: streak.longestLoggedDays,
      graceUsed: streak.graceUsed,
      graceDate: streak.graceDate,
      todayLogged: streak.todayLogged,
      todayOpen: streak.todayOpen,
    },
    consistency7Days:
      consistency7.eligibleDays >= 3
        ? { available: true, value: consistency7 }
        : metricUnavailable('minimum_logged_days'),
    consistency30Days:
      consistency30.eligibleDays >= 7
        ? { available: true, value: consistency30 }
        : metricUnavailable('minimum_logged_days'),
    calorieAdherence: weekCalorie,
    proteinAdherence: weekProtein,
    weight,
  };
}
