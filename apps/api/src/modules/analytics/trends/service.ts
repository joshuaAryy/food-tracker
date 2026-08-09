import {
  type AnalyticsPoint,
  type AnalyticsDailyPoint,
  type AnalyticsReference,
  type CanonicalTrendResponse,
  type TrendQueryInput,
  COLUMN_BACKED_NUTRIENT_KEYS,
  NUTRIENT_CATALOG,
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
        targetCalories: true,
        targetProteinGrams: true,
        targetCarbsGrams: true,
        targetFatGrams: true,
        targetFiberGrams: true,
        limitSugarGrams: true,
        limitSodiumMg: true,
      },
    }),
    prisma.foodLog.findFirst({
      where: { userId },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }],
      select: { loggedAt: true },
    }),
    prisma.waterLog.findFirst({
      where: { userId },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }],
      select: { loggedAt: true },
    }),
    prisma.weightLog.findFirst({
      where: { userId },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }],
      select: { loggedAt: true },
    }),
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
          orderBy: { loggedAt: 'asc' },
        })
      : Promise.resolve([]),
  ]);
}

interface TrendRequestContext {
  base: ReturnType<typeof loadTrendBase>;
  dataByRange: Map<string, ReturnType<typeof loadTrendData>>;
  needsWaterLogs: boolean;
  needsWeightLogs: boolean;
}

function createTrendRequestContext(
  userId: string,
  query: TrendQueryInput,
): TrendRequestContext {
  const metrics = [query.primaryMetric, query.comparisonMetric];
  return {
    base: loadTrendBase(userId),
    dataByRange: new Map(),
    needsWaterLogs: metrics.includes('hydration'),
    needsWeightLogs: metrics.includes('weight'),
  };
}

function fixedAxisDomain(
  points: readonly AnalyticsPoint[],
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

export async function computeCanonicalTrend(
  userId: string,
  query: TrendQueryInput,
  context: TrendRequestContext = createTrendRequestContext(userId, query),
): Promise<CanonicalTrendResponse> {
  const [
    profile,
    preferences,
    goal,
    firstFoodLog,
    firstWaterLog,
    firstWeightLog,
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
          targetCalories: goal?.targetCalories ?? null,
          targetProteinGrams: goal?.targetProteinGrams?.toNumber() ?? null,
          targetCarbsGrams: goal?.targetCarbsGrams?.toNumber() ?? null,
          targetFatGrams: goal?.targetFatGrams?.toNumber() ?? null,
          targetFiberGrams: goal?.targetFiberGrams?.toNumber() ?? null,
          limitSugarGrams: goal?.limitSugarGrams?.toNumber() ?? null,
          limitSodiumMg: goal?.limitSodiumMg ?? null,
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
    points,
    ...(rollingTrend === undefined ? {} : { rollingTrend }),
    summary: {
      numericDayCount: numericValues.length,
      average:
        numericValues.length === 0
          ? null
          : numericValues.reduce((sum, value) => sum + value, 0) /
            numericValues.length,
    },
    ...(query.primaryMetric === 'macroComposition'
      ? {
          macroComposition: {
            protein: macroTotal(logs, 'protein'),
            carbs: macroTotal(logs, 'carbs'),
            fat: macroTotal(logs, 'fat'),
          },
        }
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
  return {
    ...response,
    points: primaryPoints,
    comparison: {
      strategy,
      metric: query.comparisonMetric,
      points: comparisonPoints,
      reference: comparison.reference,
      sharedAxisDomain: sharedDomain,
      primaryAxisDomain: sharedDomain ?? fixedAxisDomain(primaryPoints),
      comparisonAxisDomain: sharedDomain ?? fixedAxisDomain(comparisonPoints),
    },
  };
}
