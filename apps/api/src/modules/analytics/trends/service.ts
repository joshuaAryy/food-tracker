import {
  type AnalyticsPoint,
  type AnalyticsDailyPoint,
  type AnalyticsReference,
  type TrendQueryInput,
} from '@food-tracker/shared';
import { DEFAULT_TIMEZONE } from '@food-tracker/shared';
import { addLocalDays, localDate, localDateRange } from '../../../lib/dates.js';
import { prisma } from '../../../lib/prisma.js';
import { includesLoggingDay } from './coverage-filter.js';
import { classifyLoggingDay } from './logging-day-classifier.js';
import { classifyMetricData } from './metric-data-coverage.js';
import { aggregateAnalyticsPoints } from './aggregation.js';
import { calorieReference, noReference } from './references.js';
import { resolveAnalyticsPeriod } from './ranges.js';

export interface CanonicalTrendResponse {
  timezone: string;
  trackingMode: 'simple' | 'complex';
  primaryMetric: TrendQueryInput['primaryMetric'];
  aggregation: 'daily' | 'weekly' | 'monthly';
  resolvedRange: { startDate: string; endDate: string };
  firstEligibleDate: string | null;
  today: string;
  reference: AnalyticsReference;
  points: AnalyticsPoint[];
  summary: { numericDayCount: number; average: number | null };
}

function datesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addLocalDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export async function computeCanonicalTrend(
  userId: string,
  query: TrendQueryInput,
): Promise<CanonicalTrendResponse> {
  if (
    query.primaryMetric !== 'calories' &&
    query.primaryMetric !== 'hydration'
  ) {
    throw new Error(
      'Only Calories is available while the canonical engine is being established',
    );
  }

  const [profile, preferences, goal, firstFoodLog, firstWaterLog] =
    await Promise.all([
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
        select: { goalType: true, targetCalories: true },
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
    ]);
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const today = localDate(new Date(), timezone);
  const firstEligibleLog =
    query.primaryMetric === 'hydration' ? firstWaterLog : firstFoodLog;
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
  const [logs, waterLogs] = await Promise.all([
    prisma.foodLog.findMany({
      where: { userId, loggedAt: dateRange },
      select: { mealType: true, calories: true, loggedAt: true },
      orderBy: { loggedAt: 'asc' },
    }),
    query.primaryMetric === 'hydration'
      ? prisma.waterLog.findMany({
          where: { userId, loggedAt: dateRange },
          select: { amountMl: true, loggedAt: true },
          orderBy: { loggedAt: 'asc' },
        })
      : Promise.resolve([]),
  ]);
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
          : dailyLogs.map((log) => log.calories);
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
      : calorieReference({
          goalType: goal?.goalType ?? null,
          targetCalories: goal?.targetCalories ?? null,
        })
    : noReference(query.primaryMetric);

  return {
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
    points:
      resolved.aggregation === 'daily'
        ? dailyPoints
        : aggregateAnalyticsPoints(dailyPoints, resolved.aggregation),
    summary: {
      numericDayCount: numericValues.length,
      average:
        numericValues.length === 0
          ? null
          : numericValues.reduce((sum, value) => sum + value, 0) /
            numericValues.length,
    },
  };
}
