import {
  type AnalyticsOverviewDataByKey,
  type AnalyticsOverviewEnergy,
  type AnalyticsOverviewLoggingConsistency,
  type AnalyticsOverviewMacros,
  type AnalyticsOverviewNutrientHighlight,
  type AnalyticsOverviewPeriodSummary,
  type AnalyticsOverviewResult,
  type AnalyticsOverviewResultMap,
  type AnalyticsOverviewWeight,
  type AnalyticsOverviewWeightForecast,
  type AnalyticsOverviewHydration,
  type AnalyticsSectionFailure,
  type LoggingDayPhase,
  type MetricDataState,
} from '@food-tracker/shared';
import { DEFAULT_TIMEZONE } from '@food-tracker/shared';
import {
  addLocalDays,
  localDate,
  localDateDifference,
} from '../../../lib/dates.js';
import { roundTo } from '../../../lib/serializers.js';
import { calculateStreak } from '../reporting/facts.js';
import { calorieReference, metricReference } from './references.js';
import { classifyLoggingDay } from './logging-day-classifier.js';
import { classifyMetricData } from './metric-data-coverage.js';
import {
  DEFAULT_ANALYTICS_FORECAST_POLICY,
  type AnalyticsForecastPolicy,
} from './forecast-policy.js';
import { selectDeterministicForecast } from './forecast.js';
import {
  getTrendRequestRangeData,
  type TrendRequestBase,
  type TrendRequestContext,
  type TrendRangeData,
} from './service.js';
import { resolveAnalyticsPeriod } from './ranges.js';
import type { InsightsPeriod } from './insights-diagnostics.js';

const CORE_OVERVIEW_PERIODS = { week: 7, month: 30 } as const;

type FoodLog = Awaited<TrendRangeData>[0][number];
type WaterLog = Awaited<TrendRangeData>[1][number];
type WeightLog = Awaited<TrendRangeData>[2][number];

export interface InsightsOverviewComputationContext {
  userId: string;
  base: TrendRequestBase;
  timezone: string;
  today: string;
  period: InsightsPeriod;
  startDate: string;
  endDate: string;
  logs: readonly FoodLog[];
  allFoodLogs: readonly FoodLog[];
  waterLogs: readonly WaterLog[];
  weightLogs: readonly WeightLog[];
  previousLogs: readonly FoodLog[];
  thirtyDayWeightLogs: readonly WeightLog[];
}

export type OverviewGroupComputer<
  Key extends keyof AnalyticsOverviewDataByKey,
> = (
  context: InsightsOverviewComputationContext,
) => AnalyticsOverviewDataByKey[Key] | Promise<AnalyticsOverviewDataByKey[Key]>;

export interface InsightsOverviewDependencies {
  computePeriodSummary?: OverviewGroupComputer<'periodSummary'>;
  computeEnergy?: OverviewGroupComputer<'energy'>;
  computeMacros?: OverviewGroupComputer<'macros'>;
  computeNutrientHighlights?: OverviewGroupComputer<'nutrientHighlights'>;
  computeHydration?: OverviewGroupComputer<'hydration'>;
  computeWeight?: OverviewGroupComputer<'weight'>;
  computeLoggingConsistency?: OverviewGroupComputer<'loggingConsistency'>;
  computeWeightForecast?: (input: {
    today: string;
    timezone: string;
    logs: readonly WeightLog[];
    policy?: AnalyticsForecastPolicy;
  }) => ReturnType<typeof selectDeterministicForecast>;
  now?: () => Date;
}

const failedOutcome: AnalyticsSectionFailure = {
  status: 'failed',
  code: 'section_unavailable',
  retryable: true,
};

function outcome<T>(data: T, fetchedAt: string): AnalyticsOverviewResult<T> {
  return { status: 'available', data, fetchedAt };
}

function failed<T>(): AnalyticsOverviewResult<T> {
  return { ...failedOutcome };
}

function datesInRange(startDate: string, endDate: string): string[] {
  return Array.from(
    { length: Math.max(0, localDateDifference(endDate, startDate) + 1) },
    (_, index) => addLocalDays(startDate, index),
  );
}

function byLocalDate<T extends { loggedAt: Date }>(
  logs: readonly T[],
  timezone: string,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const log of logs) {
    const date = localDate(log.loggedAt, timezone);
    result.set(date, [...(result.get(date) ?? []), log]);
  }
  return result;
}

function asNumber(
  value: number | { toString(): string } | null,
): number | null {
  if (value === null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function referenceInputs(base: TrendRequestBase[2]) {
  const goal = base;
  return {
    goalType: goal?.goalType ?? null,
    targetCalories: goal?.targetCalories ?? null,
    targetProteinGrams: asNumber(goal?.targetProteinGrams ?? null),
    targetCarbsGrams: asNumber(goal?.targetCarbsGrams ?? null),
    targetFatGrams: asNumber(goal?.targetFatGrams ?? null),
    targetFiberGrams: asNumber(goal?.targetFiberGrams ?? null),
    limitSugarGrams: asNumber(goal?.limitSugarGrams ?? null),
    limitSodiumMg: goal?.limitSodiumMg ?? null,
  };
}

function loggingDays(context: InsightsOverviewComputationContext) {
  const logsByDate = byLocalDate(context.logs, context.timezone);
  return datesInRange(context.startDate, context.endDate).map((date) => {
    const dailyLogs = logsByDate.get(date) ?? [];
    const classification = classifyLoggingDay({
      date,
      today: context.today,
      mealTypes: dailyLogs.map((log) => log.mealType),
    });
    return {
      date,
      classification,
      logged: classification.state !== 'unlogged',
    };
  });
}

function historicalStreakDays(context: InsightsOverviewComputationContext) {
  const logsByDate = byLocalDate(context.allFoodLogs, context.timezone);
  const firstDate =
    context.base[3] === null
      ? context.today
      : localDate(context.base[3].loggedAt, context.timezone);
  return datesInRange(firstDate, context.today).map((date) => {
    const dailyLogs = logsByDate.get(date) ?? [];
    const classification = classifyLoggingDay({
      date,
      today: context.today,
      mealTypes: dailyLogs.map((log) => log.mealType),
    });
    return { date, logged: classification.state !== 'unlogged' };
  });
}

function eligibleCounts(
  days: readonly ReturnType<typeof loggingDays>[number][],
  firstFoodDate: string | null,
) {
  if (days.length === 0) return { logged: 0, total: 0 };
  const firstDay = days[0]?.date;
  const firstEligible =
    firstFoodDate === null ||
    (firstDay !== undefined && firstFoodDate < firstDay)
      ? firstDay
      : firstFoodDate;
  if (
    firstEligible === undefined ||
    firstEligible > (days.at(-1)?.date ?? '')
  ) {
    return { logged: 0, total: 0 };
  }
  const eligible = days.filter((day) => day.date >= firstEligible);
  return {
    logged: eligible.filter((day) => day.logged).length,
    total: eligible.length,
  };
}

function periodSummary(
  context: InsightsOverviewComputationContext,
): AnalyticsOverviewPeriodSummary {
  const days = loggingDays(context);
  const firstFood = context.base[3];
  const firstFoodDate =
    firstFood === null ? null : localDate(firstFood.loggedAt, context.timezone);
  const eligible = eligibleCounts(days, firstFoodDate);
  const consistency =
    eligible.total === 0
      ? null
      : Math.round((eligible.logged / eligible.total) * 100);
  const loggedDayCount = days.filter((day) => day.logged).length;
  const streak = calculateStreak(historicalStreakDays(context), context.today);
  const currentDay = days.find((day) => day.date === context.today);
  const todayLogs = context.logs.filter(
    (log) => localDate(log.loggedAt, context.timezone) === context.today,
  );
  const todayCalories = classifyMetricData(
    todayLogs.map((log) => asNumber(log.calories)),
  );
  const todayProtein = classifyMetricData(
    todayLogs.map((log) => asNumber(log.protein)),
  );
  const interpretation =
    eligible.total < 7
      ? 'first_use'
      : consistency === 100
        ? 'consistent'
        : (consistency ?? 0) >= 50
          ? 'building'
          : 'needs_attention';
  return {
    resolvedRange: { startDate: context.startDate, endDate: context.endDate },
    todaySoFar: {
      date: context.today,
      mealCount: todayLogs.length,
      calories: {
        value: todayCalories.value,
        state: todayCalories.state,
      },
      protein: {
        value: todayProtein.value,
        state: todayProtein.state,
      },
    },
    loggedDayCount,
    eligibleLoggedDayCount: eligible.logged,
    eligibleTotalDayCount: eligible.total,
    streak: {
      currentDays: streak.currentLoggedDays,
      longestDays: streak.longestLoggedDays,
    },
    currentDayPhase:
      currentDay?.classification.phase ?? ('closed' as LoggingDayPhase),
    consistency,
    interpretation,
  };
}

function dailyCalories(logs: readonly FoodLog[], timezone: string) {
  const totals = byLocalDate(logs, timezone);
  return [...totals.entries()].map(([date, entries]) => ({
    date,
    calories: entries.reduce((sum, log) => sum + log.calories, 0),
  }));
}

/**
 * Matches the canonical trend summary: calculate each logged day's metric
 * first, then average those daily values. Missing snapshots remain unknown,
 * and a period with mixed daily coverage remains partial.
 */
function dailyPeriodMetric(
  logs: readonly FoodLog[],
  timezone: string,
  valueForLog: (log: FoodLog) => number | null,
): ReturnType<typeof classifyMetricData> {
  const dailyClassifications = [...byLocalDate(logs, timezone).values()].map(
    (dailyLogs) => classifyMetricData(dailyLogs.map((log) => valueForLog(log))),
  );
  const numericDailyValues = dailyClassifications.flatMap((daily) =>
    daily.value === null ? [] : [daily.value],
  );
  const recordedLogCount = dailyClassifications.reduce(
    (sum, daily) => sum + daily.recordedLogCount,
    0,
  );
  const unknownLogCount = dailyClassifications.reduce(
    (sum, daily) => sum + daily.unknownLogCount,
    0,
  );
  const state: MetricDataState =
    numericDailyValues.length === 0
      ? 'unknown'
      : dailyClassifications.every((daily) => daily.state === 'recorded')
        ? 'recorded'
        : 'partial';
  return {
    state,
    recordedLogCount,
    unknownLogCount,
    value:
      numericDailyValues.length === 0
        ? null
        : numericDailyValues.reduce((sum, value) => sum + value, 0) /
          numericDailyValues.length,
  };
}

function energy(
  context: InsightsOverviewComputationContext,
): AnalyticsOverviewEnergy {
  const currentDays = dailyCalories(context.logs, context.timezone);
  const previousDays = dailyCalories(context.previousLogs, context.timezone);
  const average =
    currentDays.length === 0
      ? null
      : currentDays.reduce((sum, day) => sum + day.calories, 0) /
        currentDays.length;
  const previousAverage =
    previousDays.length === 0
      ? null
      : previousDays.reduce((sum, day) => sum + day.calories, 0) /
        previousDays.length;
  const reference = calorieReference(referenceInputs(context.base[2]));
  const comparisonPercentage =
    previousAverage === null || previousAverage === 0 || average === null
      ? null
      : roundTo(
          ((average - previousAverage) / Math.abs(previousAverage)) * 100,
          1,
        );
  const comparison = {
    direction:
      comparisonPercentage === null
        ? ('unknown' as const)
        : comparisonPercentage > 0
          ? ('up' as const)
          : comparisonPercentage < 0
            ? ('down' as const)
            : ('unchanged' as const),
    percentage: comparisonPercentage,
  };
  if (reference.kind !== 'range') {
    return {
      average,
      numericDayCount: currentDays.length,
      reference: {
        kind: 'none',
        unit: 'kcal',
        reason: reference.kind === 'none' ? reference.reason : 'not_configured',
      },
      withinRangeDayCount: 0,
      comparison,
      status: average === null ? 'unknown' : 'no_reference',
    };
  }
  const withinRangeDayCount = currentDays.filter(
    (day) => day.calories >= reference.lower && day.calories <= reference.upper,
  ).length;
  return {
    average,
    numericDayCount: currentDays.length,
    reference: {
      kind: 'range',
      lower: reference.lower,
      upper: reference.upper,
      unit: 'kcal',
      source: reference.source,
    },
    withinRangeDayCount,
    comparison,
    status:
      average === null
        ? 'unknown'
        : average < reference.lower
          ? 'below_range'
          : average > reference.upper
            ? 'above_range'
            : 'within_range',
  };
}

function macroValues(
  logs: readonly FoodLog[],
  timezone: string,
  key: 'protein' | 'carbs' | 'fat',
) {
  return dailyPeriodMetric(logs, timezone, (log) => asNumber(log[key]));
}

function macros(
  context: InsightsOverviewComputationContext,
): AnalyticsOverviewMacros {
  const protein = macroValues(context.logs, context.timezone, 'protein');
  const carbs = macroValues(context.logs, context.timezone, 'carbs');
  const fat = macroValues(context.logs, context.timezone, 'fat');
  const values = [protein, carbs, fat];
  const totalEnergy =
    protein.value === null || carbs.value === null || fat.value === null
      ? null
      : protein.value * 4 + carbs.value * 4 + fat.value * 9;
  const percentage = (value: number | null, multiplier: number) =>
    totalEnergy === null || value === null || totalEnergy === 0
      ? null
      : roundTo((value * multiplier * 100) / totalEnergy, 1);
  const status: MetricDataState = values.every(
    (value) => value.state === 'recorded',
  )
    ? 'recorded'
    : values.some((value) => value.state !== 'unknown')
      ? 'partial'
      : 'unknown';
  return {
    protein: { grams: protein.value, percentage: percentage(protein.value, 4) },
    carbs: { grams: carbs.value, percentage: percentage(carbs.value, 4) },
    fat: { grams: fat.value, percentage: percentage(fat.value, 9) },
    status,
  };
}

function nutrientValue(log: FoodLog, metric: 'fiber' | 'sodium' | 'vitaminC') {
  if (metric === 'fiber') return asNumber(log.fiber);
  if (metric === 'sodium') return asNumber(log.sodium);
  const entry = log.nutrients.find(
    (nutrient) => nutrient.nutrientKey === metric,
  );
  return entry === undefined ? null : asNumber(entry.amount);
}

function highlight(
  context: InsightsOverviewComputationContext,
  metric: 'fiber' | 'sodium' | 'vitaminC',
): AnalyticsOverviewNutrientHighlight {
  const classification = dailyPeriodMetric(
    context.logs,
    context.timezone,
    (log) => nutrientValue(log, metric),
  );
  const reference = metricReference(metric, referenceInputs(context.base[2]));
  const unit = metric === 'fiber' ? 'g' : 'mg';
  let typedReference: AnalyticsOverviewNutrientHighlight['reference'];
  if (reference.kind === 'none') {
    typedReference = { kind: 'none', unit, reason: reference.reason };
  } else if (reference.kind === 'range') {
    typedReference = {
      kind: 'range',
      lower: reference.lower,
      upper: reference.upper,
      unit,
      source: reference.source,
    };
  } else {
    typedReference = {
      kind: reference.kind,
      value: reference.value,
      unit,
      source: reference.source,
    };
  }
  let status: AnalyticsOverviewNutrientHighlight['status'];
  if (
    classification.state !== 'recorded' ||
    typedReference.kind === 'none' ||
    classification.value === null
  ) {
    status = 'unknown';
  } else if (typedReference.kind === 'limit') {
    status =
      classification.value <= typedReference.value
        ? 'within_limit'
        : 'above_limit';
  } else if (typedReference.kind === 'minimum') {
    status =
      classification.value >= typedReference.value
        ? 'meets_minimum'
        : 'below_minimum';
  } else if (typedReference.kind === 'target') {
    status =
      classification.value < typedReference.value
        ? 'below_target'
        : classification.value > typedReference.value
          ? 'above_target'
          : 'meets_target';
  } else if (typedReference.kind === 'range') {
    status =
      classification.value < typedReference.lower
        ? 'below_range'
        : classification.value > typedReference.upper
          ? 'above_range'
          : 'within_range';
  } else {
    status = 'unknown';
  }
  return {
    metric,
    value: classification.value,
    unit,
    availability: classification.state,
    reference: typedReference,
    status,
  } as AnalyticsOverviewNutrientHighlight;
}

function nutrientHighlights(context: InsightsOverviewComputationContext) {
  return {
    highlights: [
      highlight(context, 'fiber'),
      highlight(context, 'sodium'),
      highlight(context, 'vitaminC'),
    ],
  } as AnalyticsOverviewDataByKey['nutrientHighlights'];
}

function hydration(
  context: InsightsOverviewComputationContext,
): AnalyticsOverviewHydration {
  const todayLogs = context.waterLogs.filter(
    (log) => localDate(log.loggedAt, context.timezone) === context.today,
  );
  const total = todayLogs.reduce((sum, log) => sum + log.amountMl, 0);
  const resolvedTotal = todayLogs.length === 0 ? null : total;
  const goal = context.base[1]?.dailyWaterGoalMl ?? 2000;
  return {
    today: context.today,
    timezone: context.timezone,
    total: resolvedTotal,
    goal,
    status:
      resolvedTotal === null
        ? 'unknown'
        : resolvedTotal >= goal
          ? 'goal_met'
          : 'below_goal',
    trendSection: 'hydration',
  };
}

function weightForecast(input: {
  today: string;
  timezone: string;
  logs: readonly WeightLog[];
  policy?: AnalyticsForecastPolicy;
}): ReturnType<typeof selectDeterministicForecast> {
  const observations = [...input.logs]
    .sort((left, right) => left.loggedAt.getTime() - right.loggedAt.getTime())
    .map((log) => ({
      date: localDate(log.loggedAt, input.timezone),
      value: Number(log.weightLb),
    }));
  return selectDeterministicForecast(
    observations,
    input.policy ?? DEFAULT_ANALYTICS_FORECAST_POLICY,
  );
}

function weight(
  context: InsightsOverviewComputationContext,
  forecastComputer: NonNullable<
    InsightsOverviewDependencies['computeWeightForecast']
  >,
): AnalyticsOverviewWeight {
  const ordered = [...context.thirtyDayWeightLogs].sort(
    (left, right) => left.loggedAt.getTime() - right.loggedAt.getTime(),
  );
  // A 30-day change compares the current observation with the observation
  // exactly 30 local days earlier when that observation exists.
  const recentStartDate = addLocalDays(context.today, -30);
  const recent = ordered.filter(
    (log) => localDate(log.loggedAt, context.timezone) >= recentStartDate,
  );
  const values = ordered.map((log) => Number(log.weightLb));
  const recentValues = recent.map((log) => Number(log.weightLb));
  const current = values.at(-1) ?? null;
  const changeValue =
    current === null || recentValues.length < 2
      ? null
      : roundTo(current - recentValues[0]!, 1);
  const direction =
    changeValue === null || Math.abs(changeValue) < 0.1
      ? changeValue === null
        ? 'unknown'
        : 'unchanged'
      : changeValue > 0
        ? 'up'
        : 'down';
  const target = asNumber(context.base[2]?.targetWeightLb ?? null);
  const reference =
    target === null
      ? ({ kind: 'none', unit: 'lb', reason: 'not_configured' } as const)
      : ({
          kind: 'target',
          value: target,
          unit: 'lb',
          source: 'user',
        } as const);
  const goalPathStatus =
    current === null
      ? 'unknown'
      : target === null
        ? 'no_goal'
        : Math.abs(current - target) < 0.1
          ? 'at_goal'
          : changeValue === null
            ? 'unknown'
            : (target - current) * changeValue > 0
              ? 'moving_toward'
              : 'moving_away';
  let forecast: AnalyticsOverviewWeight['forecast'];
  try {
    const result = forecastComputer({
      today: context.today,
      timezone: context.timezone,
      logs: recent,
    });
    forecast =
      result.kind === 'unavailable'
        ? failed<AnalyticsOverviewWeightForecast>()
        : outcome(
            {
              todayDate: context.today,
              horizonDays: result.horizonDays,
              points: result.points.map((point, index) => ({
                date: addLocalDays(context.today, index + 1),
                ...point,
              })),
            },
            new Date().toISOString(),
          );
  } catch {
    forecast = failed<AnalyticsOverviewWeightForecast>();
  }
  return {
    current,
    availability: values.length === 0 ? 'unknown' : 'recorded',
    change: { periodDays: 30, value: changeValue, direction },
    reference,
    goalPathStatus,
    forecast,
  };
}

function loggingConsistency(
  context: InsightsOverviewComputationContext,
): AnalyticsOverviewLoggingConsistency {
  const days = loggingDays(context);
  const eligible = eligibleCounts(
    days,
    context.base[3] === null
      ? null
      : localDate(context.base[3].loggedAt, context.timezone),
  );
  const streak = calculateStreak(historicalStreakDays(context), context.today);
  return {
    completeDayCount: days.filter(
      (day) => day.classification.state === 'complete',
    ).length,
    partialDayCount: days.filter(
      (day) => day.classification.state === 'partial',
    ).length,
    unloggedDayCount: days.filter(
      (day) => day.classification.state === 'unlogged',
    ).length,
    inProgressDayCount: days.filter(
      (day) => day.classification.phase === 'in_progress',
    ).length,
    eligibleLoggedDayCount: eligible.logged,
    eligibleTotalDayCount: eligible.total,
    streak: {
      currentDays: streak.currentLoggedDays,
      longestDays: streak.longestLoggedDays,
    },
    days: days.map((day) => ({
      date: day.date,
      loggingDayState: day.classification.state,
      loggingDayPhase: day.classification.phase,
    })),
  };
}

async function createContext(
  userId: string,
  period: InsightsPeriod,
  trendContext: TrendRequestContext,
  now: () => Date,
): Promise<InsightsOverviewComputationContext> {
  const base = await trendContext.base;
  const timezone = base[0]?.timezone ?? DEFAULT_TIMEZONE;
  const today = localDate(now(), timezone);
  const days = CORE_OVERVIEW_PERIODS[period];
  const resolved = resolveAnalyticsPeriod({
    period: { kind: 'relative', days },
    today,
    firstEligibleDate: null,
  });
  const previousEndDate = addLocalDays(resolved.startDate, -1);
  const previousStartDate = addLocalDays(previousEndDate, -(days - 1));
  const thirtyDayStartDate =
    base[5] === null
      ? addLocalDays(today, -29)
      : localDate(base[5].loggedAt, timezone);
  const allHistoryStartDate =
    base[3] === null ? today : localDate(base[3].loggedAt, timezone);
  const [selected, previous, thirtyDayWeight] = await Promise.all([
    getTrendRequestRangeData(
      userId,
      trendContext,
      resolved.startDate,
      resolved.endDate,
    ),
    getTrendRequestRangeData(
      userId,
      trendContext,
      previousStartDate,
      previousEndDate,
    ),
    getTrendRequestRangeData(userId, trendContext, thirtyDayStartDate, today),
  ]);
  const allHistory =
    base[3] === null
      ? selected
      : await getTrendRequestRangeData(
          userId,
          trendContext,
          allHistoryStartDate,
          today,
        );
  return {
    userId,
    base,
    timezone,
    today,
    period,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    logs: (await selected)[0],
    allFoodLogs: (await allHistory)[0],
    waterLogs: (await selected)[1],
    weightLogs: (await selected)[2],
    previousLogs: (await previous)[0],
    thirtyDayWeightLogs: (await thirtyDayWeight)[2],
  };
}

export async function computeInsightsOverview(
  userId: string,
  period: InsightsPeriod,
  trendContext: TrendRequestContext,
  dependencies: InsightsOverviewDependencies = {},
): Promise<AnalyticsOverviewResultMap> {
  const context = await createContext(
    userId,
    period,
    trendContext,
    dependencies.now ?? (() => new Date()),
  );
  const fetchedAt = new Date().toISOString();
  const forecastComputer = dependencies.computeWeightForecast ?? weightForecast;
  const groups: {
    [Key in keyof AnalyticsOverviewDataByKey]: OverviewGroupComputer<Key>;
  } = {
    periodSummary: dependencies.computePeriodSummary ?? periodSummary,
    energy: dependencies.computeEnergy ?? energy,
    macros: dependencies.computeMacros ?? macros,
    nutrientHighlights:
      dependencies.computeNutrientHighlights ?? nutrientHighlights,
    hydration: dependencies.computeHydration ?? hydration,
    weight:
      dependencies.computeWeight ??
      ((input) => weight(input, forecastComputer)),
    loggingConsistency:
      dependencies.computeLoggingConsistency ?? loggingConsistency,
  };
  const entries = await Promise.all(
    (Object.keys(groups) as (keyof AnalyticsOverviewDataByKey)[]).map(
      async (key) => {
        try {
          const data = await groups[key](context);
          return [key, outcome(data, fetchedAt)] as const;
        } catch {
          return [
            key,
            failed<AnalyticsOverviewDataByKey[typeof key]>(),
          ] as const;
        }
      },
    ),
  );
  return Object.fromEntries(entries) as AnalyticsOverviewResultMap;
}
