import {
  type AnalyticsPoint,
  type AnalyticsDailyPoint,
  type AnalyticsReference,
  type AnalyticsMetricKey,
  type CanonicalTrendResponse,
  type TrendQueryInput,
  COLUMN_BACKED_NUTRIENT_KEYS,
  NUTRIENT_CATALOG,
  NUTRIENT_KEYS,
  relatedAnalyticsMetricsForKey,
  type NutrientKey,
} from '@food-tracker/shared';
import { DEFAULT_TIMEZONE } from '@food-tracker/shared';
import { addLocalDays, localDate, localDateRange } from '../../../lib/dates.js';
import { AppError } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { includesLoggingDay } from './coverage-filter.js';
import { classifyLoggingDay } from './logging-day-classifier.js';
import { classifyMetricData } from './metric-data-coverage.js';
import { aggregateAnalyticsPoints } from './aggregation.js';
import { metricReference, noReference } from './references.js';
import { resolveAnalyticsPeriod } from './ranges.js';
import { resolveComparisonStrategy } from './comparisons.js';
import { rollingAverageValues, smoothingWindowForTrend } from './smoothing.js';
import {
  eligibleCalorieForecastPoints,
  DEFAULT_ANALYTICS_FORECAST_POLICY,
} from './forecast-policy.js';
import { selectDeterministicForecast } from './forecast.js';
import { interpretAnalyticsReference } from './interpretation.js';
import { resolveUserReportingGoals } from '../../nutritionTargets/reporting-adapter.js';

function loadTrendBase(userId: string) {
  return Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
    prisma.trackingPreference.findUnique({
      where: { userId },
      select: { mode: true, dailyWaterGoalMl: true },
    }),
    prisma.userGoal.findUnique({
      where: { userId },
      select: {
        goalType: true,
        targetWeightLb: true,
      },
    }),
    prisma.foodLog.findFirst({
      where: { userId },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { loggedAt: true },
    }),
    prisma.waterLog.findFirst({
      where: { userId },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { loggedAt: true },
    }),
    prisma.weightLog.findFirst({
      where: { userId },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { loggedAt: true },
    }),
    resolveUserReportingGoals(userId),
  ]);
}

function loadTrendData(
  userId: string,
  dateRange: ReturnType<typeof localDateRange>,
  options: { needsWaterLogs: boolean; needsWeightLogs: boolean },
) {
  return Promise.all([
    prisma.foodLog.findMany({
      where: { userId, loggedAt: dateRange },
      select: {
        mealType: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        fiber: true,
        sugar: true,
        sodium: true,
        loggedAt: true,
        nutrients: { select: { nutrientKey: true, amount: true } },
      },
      orderBy: { loggedAt: 'asc' },
    }),
    options.needsWaterLogs
      ? prisma.waterLog.findMany({
          where: { userId, loggedAt: dateRange },
          select: { amountMl: true, loggedAt: true },
          orderBy: { loggedAt: 'asc' },
        })
      : Promise.resolve([]),
    options.needsWeightLogs
      ? prisma.weightLog.findMany({
          where: { userId, loggedAt: dateRange },
          select: { weightLb: true, loggedAt: true },
          orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        })
      : Promise.resolve([]),
  ]);
}

export interface TrendRequestContext {
  base: ReturnType<typeof loadTrendBase>;
  dataByRange: Map<string, ReturnType<typeof loadTrendData>>;
  needsWaterLogs: boolean;
  needsWeightLogs: boolean;
}

export type TrendRequestBase = Awaited<ReturnType<typeof loadTrendBase>>;
export type TrendRangeData = Awaited<ReturnType<typeof loadTrendData>>;

export function createTrendRequestContext(
  userId: string,
  metrics: readonly AnalyticsMetricKey[],
): TrendRequestContext {
  return {
    base: loadTrendBase(userId),
    dataByRange: new Map(),
    needsWaterLogs: metrics.includes('hydration'),
    needsWeightLogs: metrics.includes('weight'),
  };
}

/**
 * Shares the bounded request data cache between core trend and overview
 * calculators. Overview facts must use the same FoodLog snapshots and local
 * date boundaries as the canonical trend engine.
 */
export async function getTrendRequestRangeData(
  userId: string,
  context: TrendRequestContext,
  startDate: string,
  endDate: string,
): Promise<TrendRangeData> {
  const [profile] = await context.base;
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const rangeKey = `${startDate}:${endDate}`;
  const existing = context.dataByRange.get(rangeKey);
  if (existing !== undefined) return existing;
  const rangeData = loadTrendData(
    userId,
    localDateRange(timezone, { startDate, endDate }),
    context,
  );
  context.dataByRange.set(rangeKey, rangeData);
  return rangeData;
}

function fixedAxisDomain(
  points: readonly Pick<AnalyticsPoint, 'value'>[],
  zeroBaseline = false,
) {
  const values = points.flatMap((point) =>
    point.value !== null && Number.isFinite(point.value) ? [point.value] : [],
  );
  if (values.length === 0) return null;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (zeroBaseline) {
    return {
      minimum: Math.min(0, minimum),
      maximum: maximum === 0 ? 1 : maximum,
    };
  }
  return minimum === maximum
    ? { minimum: Math.min(0, minimum), maximum: maximum === 0 ? 1 : maximum }
    : { minimum, maximum };
}

function referenceNormalizationValue(
  reference: AnalyticsReference,
): number | null {
  if (reference.kind === 'none') return null;
  if (reference.kind === 'range') return reference.upper - reference.lower;
  return reference.value;
}

function withNormalizedPoints(
  points: readonly AnalyticsPoint[],
  reference: AnalyticsReference,
): AnalyticsPoint[] {
  const denominator = referenceNormalizationValue(reference);
  if (denominator === null || denominator <= 0) return [...points];
  return points.map((point) =>
    point.value === null
      ? point
      : { ...point, normalizedValue: point.value / denominator },
  );
}

function datesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addLocalDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function inclusiveRangeDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function trendForecast({
  metric,
  includeForecast,
  today,
  dailyPoints,
}: {
  metric: TrendQueryInput['primaryMetric'];
  includeForecast: boolean | undefined;
  today: string;
  dailyPoints: readonly AnalyticsDailyPoint[];
}): CanonicalTrendResponse['forecast'] {
  if (!includeForecast) return undefined;
  if (metric !== 'calories' && metric !== 'weight') {
    return { kind: 'unavailable', reason: 'not_applicable' };
  }
  const observations =
    metric === 'calories'
      ? eligibleCalorieForecastPoints(dailyPoints)
      : dailyPoints.flatMap((point) =>
          point.value === null
            ? []
            : [{ date: point.date, value: point.value }],
        );
  const selected = selectDeterministicForecast(
    observations,
    DEFAULT_ANALYTICS_FORECAST_POLICY,
  );
  if (selected.kind === 'unavailable') return selected;
  return {
    kind: 'available',
    model: selected.model,
    todayDate: today,
    horizonDays: selected.horizonDays,
    points: selected.points.map((point, index) => ({
      date: addLocalDays(today, index + 1),
      ...point,
    })),
  };
}

type ColumnFoodMetric = (typeof COLUMN_BACKED_NUTRIENT_KEYS)[number];

interface ColumnFoodMetricLog {
  calories: number;
  protein: { toString(): string };
  carbs: { toString(): string } | null;
  fat: { toString(): string } | null;
  fiber: { toString(): string } | null;
  sugar: { toString(): string } | null;
  sodium: number | null;
}

function numericSnapshotValue(
  value: number | { toString(): string } | null,
): number | null {
  if (value === null) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function coreFoodMetricValue(
  log: ColumnFoodMetricLog,
  metric: ColumnFoodMetric,
): number | null {
  switch (metric) {
    case 'calories':
      return numericSnapshotValue(log.calories);
    case 'protein':
      return numericSnapshotValue(log.protein);
    case 'carbs':
      return numericSnapshotValue(log.carbs);
    case 'fat':
      return numericSnapshotValue(log.fat);
    case 'fiber':
      return numericSnapshotValue(log.fiber);
    case 'sugar':
      return numericSnapshotValue(log.sugar);
    case 'sodium':
      return numericSnapshotValue(log.sodium);
  }
}

function macroTotal(
  logs: readonly {
    protein: { toString(): string };
    carbs: { toString(): string } | null;
    fat: { toString(): string } | null;
  }[],
  key: 'protein' | 'carbs' | 'fat',
): number | null {
  const values = logs
    .map((log) => log[key])
    .filter((value): value is { toString(): string } => value !== null)
    .map((value) => Number(value));
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0);
}

function macroPercentages(composition: {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}) {
  const proteinEnergy =
    composition.protein === null ? null : composition.protein * 4;
  const carbsEnergy = composition.carbs === null ? null : composition.carbs * 4;
  const fatEnergy = composition.fat === null ? null : composition.fat * 9;
  const totalEnergy =
    proteinEnergy === null || carbsEnergy === null || fatEnergy === null
      ? null
      : proteinEnergy + carbsEnergy + fatEnergy;
  const percentage = (value: number | null) =>
    totalEnergy === null || value === null || totalEnergy === 0
      ? null
      : Math.round((value * 1000) / totalEnergy) / 10;
  return {
    protein: percentage(proteinEnergy),
    carbs: percentage(carbsEnergy),
    fat: percentage(fatEnergy),
  };
}

function macroDailyMix(
  logsByDate: ReadonlyMap<string, readonly ColumnFoodMetricLog[]>,
  dates: readonly string[],
) {
  return dates.flatMap((date) => {
    const logs = logsByDate.get(date) ?? [];
    if (logs.length === 0) return [];
    const percentages = macroPercentages({
      protein: macroTotal(logs, 'protein'),
      carbs: macroTotal(logs, 'carbs'),
      fat: macroTotal(logs, 'fat'),
    });
    return [{ date, ...percentages }];
  });
}

function macroAverageEnergy(
  logsByDate: ReadonlyMap<string, readonly ColumnFoodMetricLog[]>,
): number | null {
  const dailyTotals = [...logsByDate.values()].flatMap((logs) => {
    const calories = logs
      .map((log) => Number(log.calories))
      .filter((value) => Number.isFinite(value));
    return calories.length === 0
      ? []
      : [calories.reduce((sum, value) => sum + value, 0)];
  });
  return dailyTotals.length === 0
    ? null
    : dailyTotals.reduce((sum, value) => sum + value, 0) / dailyTotals.length;
}

function weightFacts(
  weightLogs: readonly { weightLb: { toString(): string }; loggedAt: Date }[],
  target: number | null,
  timezone: string,
  eligibleDayCount: number,
) {
  const values = weightLogs.map((log) => Number(log.weightLb));
  const current = values.at(-1) ?? null;
  const change = values.length < 2 ? null : current! - values[0]!;
  const direction =
    change === null || Math.abs(change) < 0.1
      ? change === null
        ? 'unknown'
        : 'unchanged'
      : change > 0
        ? 'up'
        : 'down';
  const goalPath =
    current === null
      ? 'unknown'
      : target === null
        ? 'no_goal'
        : Math.abs(current - target) < 0.1
          ? 'at_goal'
          : change === null
            ? 'unknown'
            : (target - current) * change > 0
              ? 'moving_toward'
              : 'moving_away';
  return {
    current,
    change,
    direction,
    target,
    goalPath,
    recordedDayCount: new Set(
      weightLogs.map((log) => localDate(log.loggedAt, timezone)),
    ).size,
    eligibleDayCount,
  } as const;
}

function loggingSummary(
  points: readonly Extract<
    CanonicalTrendResponse['points'][number],
    { kind: 'daily' }
  >[],
  today: string,
  mealsByDate: ReadonlyMap<string, readonly { mealType: string }[]>,
) {
  const complete = points.filter(
    (point) => point.loggingDayState === 'complete',
  ).length;
  const partial = points.filter(
    (point) => point.loggingDayState === 'partial',
  ).length;
  const unlogged = points.filter(
    (point) => point.loggingDayState === 'unlogged',
  ).length;
  const inProgress = points.filter(
    (point) => point.loggingDayPhase === 'in_progress',
  ).length;
  const eligible = complete + partial;
  return {
    complete,
    partial,
    unlogged,
    inProgress,
    consistency:
      eligible + unlogged === 0
        ? null
        : Math.round((eligible * 100) / (eligible + unlogged)),
    currentDayPhase:
      points.find((point) => point.date === today)?.loggingDayPhase ?? 'closed',
    mealCoverage: points.map((point) => {
      const meals = mealsByDate.get(point.date) ?? [];
      return {
        date: point.date,
        breakfast: meals.some((meal) => meal.mealType === 'breakfast'),
        lunch: meals.some((meal) => meal.mealType === 'lunch'),
        dinner: meals.some((meal) => meal.mealType === 'dinner'),
        snack: meals.some((meal) => meal.mealType === 'snack'),
      };
    }),
  } as const;
}

function metricDataSummary(
  points: readonly CanonicalTrendResponse['points'][number][],
  numericValues: readonly number[],
) {
  const counts = { recorded: 0, partial: 0, unknown: 0 };
  for (const point of points) {
    if (point.kind === 'aggregated') {
      counts.recorded += point.metricCounts.recorded;
      counts.partial += point.metricCounts.partial;
      counts.unknown += point.metricCounts.unknown;
      continue;
    }
    if (point.metricDataState !== null) counts[point.metricDataState] += 1;
  }
  const observed = counts.recorded + counts.partial + counts.unknown;
  const state =
    observed === 0
      ? 'no_food_logs'
      : counts.recorded + counts.partial === 0
        ? 'not_recorded'
        : numericValues.length > 0 &&
            numericValues.every((value) => value === 0)
          ? 'recorded_zero'
          : counts.recorded < observed / 2
            ? 'sparse'
            : 'available';
  return { ...counts, state } as const;
}

function calorieRangeSummary(
  points: readonly Extract<
    CanonicalTrendResponse['points'][number],
    { kind: 'daily' }
  >[],
  reference: AnalyticsReference,
) {
  const values = points.flatMap((point) =>
    point.value === null ? [] : [point.value],
  );
  const insideRangeDayCount =
    reference.kind !== 'range'
      ? 0
      : values.filter(
          (value) => value >= reference.lower && value <= reference.upper,
        ).length;
  return {
    insideRangeDayCount,
    eligibleDayCount: values.length,
    status:
      values.length < 2
        ? ('insufficient_data' as const)
        : insideRangeDayCount > 0
          ? ('inside_usual_range' as const)
          : ('outside_usual_range' as const),
  };
}

function normalizedNutrientValue(
  log: {
    nutrients: readonly {
      nutrientKey: string;
      amount: { toString(): string };
    }[];
  },
  metric: string,
): number | null {
  const nutrient = log.nutrients.find((entry) => entry.nutrientKey === metric);
  return nutrient === undefined ? null : numericSnapshotValue(nutrient.amount);
}

function aminoAcidProfile(
  logs: readonly {
    loggedAt: Date;
    nutrients: readonly {
      nutrientKey: string;
      amount: { toString(): string };
    }[];
  }[],
  timezone: string,
  goals: import('@food-tracker/shared').ReportingGoals,
) {
  const keys = NUTRIENT_KEYS.filter(
    (key): key is Exclude<NutrientKey, 'water'> =>
      key !== 'water' && NUTRIENT_CATALOG[key].category === 'amino_acid',
  );
  const recordedDates = new Set<string>();
  const entries = keys.map((metric) => {
    const dailyTotals = new Map<string, number>();
    for (const log of logs) {
      const value = normalizedNutrientValue(log, metric);
      if (value === null) continue;
      const date = localDate(log.loggedAt, timezone);
      recordedDates.add(date);
      dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + value);
    }
    const values = [...dailyTotals.values()];
    const average =
      values.length === 0
        ? null
        : Math.round(
            (values.reduce((sum, value) => sum + value, 0) / values.length +
              Number.EPSILON) *
              10000,
          ) / 10000;
    const reportingGoal = goals[metric];
    const reference =
      reportingGoal === undefined || reportingGoal.value === null
        ? {
            kind: 'none' as const,
            unit: NUTRIENT_CATALOG[metric].defaultUnit,
            reason: 'not_configured' as const,
          }
        : {
            kind: reportingGoal.direction,
            value: reportingGoal.value,
            unit: reportingGoal.unit,
            source:
              reportingGoal.source === 'missing'
                ? 'default'
                : reportingGoal.source,
          };
    const percentage =
      average === null || reference.kind === 'none' || reference.value === 0
        ? null
        : Math.round((average * 1000) / reference.value) / 10;
    return {
      metric,
      average,
      reference,
      percentage,
      status:
        average === null || reference.kind === 'none'
          ? ('unknown' as const)
          : average >= reference.value
            ? ('meets_minimum' as const)
            : ('below_minimum' as const),
    };
  });
  return { recordedDayCount: recordedDates.size, entries };
}

export async function computeCanonicalTrend(
  userId: string,
  query: TrendQueryInput,
  context: TrendRequestContext = createTrendRequestContext(userId, [
    query.primaryMetric,
    ...(query.comparisonMetric === undefined ? [] : [query.comparisonMetric]),
  ]),
): Promise<CanonicalTrendResponse> {
  const [
    profile,
    preferences,
    goal,
    firstFoodLog,
    firstWaterLog,
    firstWeightLog,
    reportingGoals,
  ] = await context.base;
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const today = localDate(new Date(), timezone);
  const firstEligibleLog =
    query.primaryMetric === 'hydration'
      ? firstWaterLog
      : query.primaryMetric === 'weight'
        ? firstWeightLog
        : firstFoodLog;
  const firstEligibleDate =
    firstEligibleLog === null
      ? null
      : localDate(firstEligibleLog.loggedAt, timezone);
  const resolved = resolveAnalyticsPeriod({
    period: query.period,
    today,
    firstEligibleDate,
    requestedAggregation: query.aggregation,
  });
  const dateRange = localDateRange(timezone, {
    startDate: resolved.startDate,
    endDate: resolved.endDate,
  });
  const rangeKey = `${resolved.startDate}:${resolved.endDate}`;
  const rangeData =
    context.dataByRange.get(rangeKey) ??
    loadTrendData(userId, dateRange, context);
  context.dataByRange.set(rangeKey, rangeData);
  const [logs, waterLogs, weightLogs] = await rangeData;
  const logsByDate = new Map<string, typeof logs>();
  for (const log of logs) {
    const date = localDate(log.loggedAt, timezone);
    logsByDate.set(date, [...(logsByDate.get(date) ?? []), log]);
  }
  const waterLogsByDate = new Map<string, typeof waterLogs>();
  for (const waterLog of waterLogs) {
    const date = localDate(waterLog.loggedAt, timezone);
    waterLogsByDate.set(date, [...(waterLogsByDate.get(date) ?? []), waterLog]);
  }
  const weightLogsByDate = new Map<string, typeof weightLogs>();
  for (const weightLog of weightLogs) {
    const date = localDate(weightLog.loggedAt, timezone);
    weightLogsByDate.set(date, [
      ...(weightLogsByDate.get(date) ?? []),
      weightLog,
    ]);
  }

  const dailyPoints = datesInRange(resolved.startDate, resolved.endDate).map(
    (date) => {
      const dailyLogs = logsByDate.get(date) ?? [];
      const logging = classifyLoggingDay({
        date,
        today,
        mealTypes: dailyLogs.map((log) => log.mealType),
      });
      const metricValues =
        query.primaryMetric === 'hydration'
          ? (waterLogsByDate.get(date) ?? []).map(
              (waterLog) => waterLog.amountMl,
            )
          : query.primaryMetric === 'weight'
            ? (weightLogsByDate.get(date) ?? []).map((weightLog) =>
                Number(weightLog.weightLb),
              )
            : query.primaryMetric === 'loggingConsistency'
              ? dailyLogs.length === 0
                ? []
                : [logging.state === 'complete' ? 100 : 50]
              : query.primaryMetric === 'macroComposition'
                ? []
                : NUTRIENT_CATALOG[
                      query.primaryMetric as keyof typeof NUTRIENT_CATALOG
                    ]?.storage === 'normalized'
                  ? dailyLogs.map((log) =>
                      normalizedNutrientValue(log, query.primaryMetric),
                    )
                  : dailyLogs.map((log) =>
                      coreFoodMetricValue(
                        log,
                        query.primaryMetric as
                          | 'calories'
                          | 'protein'
                          | 'carbs'
                          | 'fat'
                          | 'fiber'
                          | 'sugar'
                          | 'sodium',
                      ),
                    );
      const metric =
        metricValues.length === 0 ? null : classifyMetricData(metricValues);
      const point: AnalyticsDailyPoint = {
        kind: 'daily',
        date,
        loggingDayState: logging.state,
        loggingDayPhase: logging.phase,
        metricDataState: metric?.state ?? null,
        value: metric?.value ?? null,
        foodLogCount: dailyLogs.length,
        metricRecordedLogCount: metric?.recordedLogCount ?? 0,
        metricUnknownLogCount: metric?.unknownLogCount ?? 0,
      };
      return point;
    },
  );
  const numericValues = dailyPoints.flatMap((point) => {
    const included =
      query.primaryMetric === 'hydration' ||
      query.primaryMetric === 'weight' ||
      includesLoggingDay(point, query.coverageFilter);
    return included && point.value !== null ? [point.value] : [];
  });
  const reference = query.showReference
    ? query.primaryMetric === 'hydration'
      ? {
          kind: 'target' as const,
          value: preferences?.dailyWaterGoalMl ?? 2000,
          unit: 'mL' as const,
          source: 'default' as const,
        }
      : metricReference(query.primaryMetric, {
          goalType: goal?.goalType ?? null,
          targetCalories: null,
          targetProteinGrams: null,
          targetCarbsGrams: null,
          targetFatGrams: null,
          targetFiberGrams: null,
          limitSugarGrams: null,
          limitSodiumMg: null,
          reportingGoals,
        })
    : noReference(query.primaryMetric);

  const points =
    resolved.aggregation === 'daily'
      ? dailyPoints
      : aggregateAnalyticsPoints(dailyPoints, resolved.aggregation);
  const rollingWindow = smoothingWindowForTrend({
    aggregation: resolved.aggregation,
    periodDays: inclusiveRangeDays(resolved.startDate, resolved.endDate),
  });
  const rollingTrend =
    query.primaryMetric === 'macroComposition'
      ? undefined
      : {
          window: rollingWindow,
          values: rollingAverageValues(
            points.map((point) => point.value),
            points.map((point) => {
              if (
                query.primaryMetric === 'hydration' ||
                query.primaryMetric === 'weight'
              ) {
                return point.value !== null;
              }
              return point.kind === 'daily'
                ? includesLoggingDay(point, query.coverageFilter)
                : point.numericDayCount > 0;
            }),
            rollingWindow,
          ),
        };
  const forecast = trendForecast({
    metric: query.primaryMetric,
    includeForecast: query.includeForecast,
    today,
    dailyPoints,
  });
  const dataSummary = metricDataSummary(points, numericValues);
  const response: CanonicalTrendResponse = {
    timezone,
    trackingMode: preferences?.mode ?? 'simple',
    primaryMetric: query.primaryMetric,
    aggregation: resolved.aggregation,
    resolvedRange: {
      startDate: resolved.startDate,
      endDate: resolved.endDate,
    },
    firstEligibleDate,
    today,
    reference,
    interpretation: interpretAnalyticsReference(
      numericValues.length === 0
        ? null
        : numericValues.reduce((sum, value) => sum + value, 0) /
            numericValues.length,
      reference,
    ),
    relatedMetrics: [...relatedAnalyticsMetricsForKey(query.primaryMetric)],
    points,
    ...(rollingTrend === undefined ? {} : { rollingTrend }),
    ...(forecast === undefined ? {} : { forecast }),
    summary: {
      numericDayCount: numericValues.length,
      average:
        numericValues.length === 0
          ? null
          : numericValues.reduce((sum, value) => sum + value, 0) /
            numericValues.length,
    },
    metricDataSummary: dataSummary,
    ...(query.primaryMetric === 'calories'
      ? { calorieRangeSummary: calorieRangeSummary(dailyPoints, reference) }
      : {}),
    ...(query.primaryMetric === 'macroComposition'
      ? {
          macroComposition: {
            protein: macroTotal(logs, 'protein'),
            carbs: macroTotal(logs, 'carbs'),
            fat: macroTotal(logs, 'fat'),
          },
          macroPercentages: macroPercentages({
            protein: macroTotal(logs, 'protein'),
            carbs: macroTotal(logs, 'carbs'),
            fat: macroTotal(logs, 'fat'),
          }),
          macroAverageEnergy: macroAverageEnergy(logsByDate),
          macroDailyMix: macroDailyMix(
            logsByDate,
            datesInRange(resolved.startDate, resolved.endDate),
          ),
        }
      : {}),
    ...(query.primaryMetric === 'weight'
      ? {
          weightFacts: weightFacts(
            weightLogs,
            goal?.targetWeightLb === null || goal?.targetWeightLb === undefined
              ? null
              : Number(goal.targetWeightLb),
            timezone,
            inclusiveRangeDays(resolved.startDate, resolved.endDate),
          ),
        }
      : {}),
    loggingSummary: loggingSummary(dailyPoints, today, logsByDate),
    ...(query.primaryMetric === 'leucine'
      ? { aminoAcidProfile: aminoAcidProfile(logs, timezone, reportingGoals) }
      : {}),
  };
  if (query.comparisonMetric === undefined) return response;

  const strategy = resolveComparisonStrategy(
    query.primaryMetric,
    query.comparisonMetric,
  );
  if (strategy === 'incompatible') return response;
  const { comparisonMetric: _comparisonMetric, ...comparisonQuery } = query;
  void _comparisonMetric;
  const comparison = await computeCanonicalTrend(
    userId,
    {
      ...comparisonQuery,
      primaryMetric: query.comparisonMetric,
    },
    context,
  );
  if (
    strategy === 'reference_normalized' &&
    (referenceNormalizationValue(response.reference) === null ||
      referenceNormalizationValue(comparison.reference) === null)
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Both metrics need an authoritative reference for normalized comparison',
    );
  }
  const primaryPoints =
    strategy === 'reference_normalized'
      ? withNormalizedPoints(response.points, response.reference)
      : response.points;
  const comparisonPoints =
    strategy === 'reference_normalized'
      ? withNormalizedPoints(comparison.points, comparison.reference)
      : comparison.points;
  const sharedDomain =
    strategy === 'shared_unit'
      ? fixedAxisDomain([...primaryPoints, ...comparisonPoints], true)
      : null;
  const normalizedDomain =
    strategy === 'reference_normalized'
      ? fixedAxisDomain(
          [...primaryPoints, ...comparisonPoints].map((point) => ({
            value: point.normalizedValue ?? null,
          })),
          true,
        )
      : null;
  return {
    ...response,
    points: primaryPoints,
    comparison: {
      strategy,
      metric: query.comparisonMetric,
      points: comparisonPoints,
      reference: comparison.reference,
      sharedAxisDomain: sharedDomain ?? normalizedDomain,
      primaryAxisDomain:
        sharedDomain ?? normalizedDomain ?? fixedAxisDomain(primaryPoints),
      comparisonAxisDomain:
        sharedDomain ?? normalizedDomain ?? fixedAxisDomain(comparisonPoints),
    },
  };
}
