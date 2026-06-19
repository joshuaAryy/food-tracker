import {
  DEFAULT_TIMEZONE,
  type AdvancedAnalytics,
  type NutrientValues,
} from '@food-tracker/shared';
import { addLocalDays, localDate, localDateRange } from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { roundTo } from '../../lib/serializers.js';

const EMPTY_NUTRIENTS: NutrientValues = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
};

interface AdvancedAnalyticsInput {
  date?: string | undefined;
  timezone?: string | undefined;
  rangeDays: number;
}

interface TimeRange {
  gte: Date;
  lt: Date;
}

function requiredRange(
  timezone: string,
  startDate: string,
  endDate: string,
): TimeRange {
  const range = localDateRange(timezone, { startDate, endDate });

  if (range.gte === undefined || range.lt === undefined) {
    throw new Error('A bounded local date range is required');
  }

  return { gte: range.gte, lt: range.lt };
}

function inRange(date: Date, range: TimeRange): boolean {
  return date >= range.gte && date < range.lt;
}

function nutrientTotals(
  logs: Array<{
    calories: number;
    protein: { toNumber(): number };
    carbs: { toNumber(): number } | null;
    fat: { toNumber(): number } | null;
    fiber: { toNumber(): number } | null;
    sugar: { toNumber(): number } | null;
    sodium: number | null;
  }>,
): NutrientValues {
  const totals = logs.reduce<NutrientValues>(
    (sum, log) => ({
      calories: sum.calories + log.calories,
      protein: sum.protein + log.protein.toNumber(),
      carbs: sum.carbs + (log.carbs?.toNumber() ?? 0),
      fat: sum.fat + (log.fat?.toNumber() ?? 0),
      fiber: sum.fiber + (log.fiber?.toNumber() ?? 0),
      sugar: sum.sugar + (log.sugar?.toNumber() ?? 0),
      sodium: sum.sodium + (log.sodium ?? 0),
    }),
    { ...EMPTY_NUTRIENTS },
  );

  return {
    calories: Math.round(totals.calories),
    protein: roundTo(totals.protein, 1),
    carbs: roundTo(totals.carbs, 1),
    fat: roundTo(totals.fat, 1),
    fiber: roundTo(totals.fiber, 1),
    sugar: roundTo(totals.sugar, 1),
    sodium: Math.round(totals.sodium),
  };
}

function nutrientAverages(
  totals: NutrientValues,
  loggedDays: number,
): NutrientValues {
  if (loggedDays === 0) return { ...EMPTY_NUTRIENTS };

  return {
    calories: roundTo(totals.calories / loggedDays, 1),
    protein: roundTo(totals.protein / loggedDays, 1),
    carbs: roundTo(totals.carbs / loggedDays, 1),
    fat: roundTo(totals.fat / loggedDays, 1),
    fiber: roundTo(totals.fiber / loggedDays, 1),
    sugar: roundTo(totals.sugar / loggedDays, 1),
    sodium: roundTo(totals.sodium / loggedDays, 1),
  };
}

function macroCalorieSplit(totals: NutrientValues) {
  const proteinCalories = totals.protein * 4;
  const carbCalories = totals.carbs * 4;
  const fatCalories = totals.fat * 9;
  const macroCalories = proteinCalories + carbCalories + fatCalories;

  if (macroCalories === 0) {
    return { proteinPercent: 0, carbsPercent: 0, fatPercent: 0 };
  }

  return {
    proteinPercent: roundTo((proteinCalories / macroCalories) * 100, 1),
    carbsPercent: roundTo((carbCalories / macroCalories) * 100, 1),
    fatPercent: roundTo((fatCalories / macroCalories) * 100, 1),
  };
}

function weeklyWeightSlope(
  logs: Array<{ loggedAt: Date; weightLb: { toNumber(): number } }>,
): number | null {
  if (logs.length < 2) return null;

  const origin = logs[0]?.loggedAt.getTime();
  if (origin === undefined) return null;

  const points = logs.map((log) => ({
    x: (log.loggedAt.getTime() - origin) / 86_400_000,
    y: log.weightLb.toNumber(),
  }));
  const meanX =
    points.reduce((total, point) => total + point.x, 0) / points.length;
  const meanY =
    points.reduce((total, point) => total + point.y, 0) / points.length;
  const denominator = points.reduce(
    (total, point) => total + (point.x - meanX) ** 2,
    0,
  );

  if (denominator === 0) return null;

  const numerator = points.reduce(
    (total, point) => total + (point.x - meanX) * (point.y - meanY),
    0,
  );

  return roundTo((numerator / denominator) * 7, 2);
}

export async function computeAdvancedAnalytics(
  userId: string,
  input: AdvancedAnalyticsInput,
  now = new Date(),
): Promise<AdvancedAnalytics> {
  const [profile, goals, preferences] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.trackingPreference.findUnique({ where: { userId } }),
  ]);
  const timezone = input.timezone ?? profile?.timezone ?? DEFAULT_TIMEZONE;
  const endDate = input.date ?? localDate(now, timezone);
  const selectedStartDate = addLocalDays(endDate, -(input.rangeDays - 1));
  const sevenDayStart = addLocalDays(endDate, -6);
  const thirtyDayStart = addLocalDays(endDate, -29);
  const earliestFoodDate =
    selectedStartDate < thirtyDayStart ? selectedStartDate : thirtyDayStart;
  const selectedRange = requiredRange(timezone, selectedStartDate, endDate);
  const sevenDayRange = requiredRange(timezone, sevenDayStart, endDate);
  const thirtyDayRange = requiredRange(timezone, thirtyDayStart, endDate);
  const foodQueryRange = requiredRange(timezone, earliestFoodDate, endDate);
  const [foodLogs, weightLogs] = await Promise.all([
    prisma.foodLog.findMany({
      where: { userId, loggedAt: foodQueryRange },
      select: {
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        fiber: true,
        sugar: true,
        sodium: true,
        loggedAt: true,
      },
    }),
    prisma.weightLog.findMany({
      where: { userId, loggedAt: selectedRange },
      select: { weightLb: true, loggedAt: true },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);
  const selectedLogs = foodLogs.filter((log) =>
    inRange(log.loggedAt, selectedRange),
  );
  const sevenDayLogs = foodLogs.filter((log) =>
    inRange(log.loggedAt, sevenDayRange),
  );
  const thirtyDayLogs = foodLogs.filter((log) =>
    inRange(log.loggedAt, thirtyDayRange),
  );
  const selectedLoggedDays = new Set(
    selectedLogs.map((log) => localDate(log.loggedAt, timezone)),
  ).size;
  const sevenLoggedDays = new Set(
    sevenDayLogs.map((log) => localDate(log.loggedAt, timezone)),
  ).size;
  const thirtyLoggedDays = new Set(
    thirtyDayLogs.map((log) => localDate(log.loggedAt, timezone)),
  ).size;
  const selectedTotals = nutrientTotals(selectedLogs);
  const sevenTotals = nutrientTotals(sevenDayLogs);
  const thirtyTotals = nutrientTotals(thirtyDayLogs);
  const averageCalories7 = roundTo(sevenTotals.calories / 7, 1);
  const averageCalories30 = roundTo(thirtyTotals.calories / 30, 1);
  const averageProtein7 = roundTo(sevenTotals.protein / 7, 1);
  const averageProtein30 = roundTo(thirtyTotals.protein / 30, 1);
  const latestWeight = weightLogs.at(-1) ?? null;
  const previousWeight = weightLogs.at(-2) ?? null;

  return {
    date: endDate,
    timezone,
    rangeDays: input.rangeDays,
    range: { startDate: selectedStartDate, endDate },
    trackingMode: preferences?.mode ?? 'simple',
    targets: {
      calories: goals?.targetCalories ?? null,
      proteinGrams: goals?.targetProteinGrams?.toNumber() ?? null,
    },
    calorieTrend: {
      average7Day: averageCalories7,
      average30Day: averageCalories30,
      difference: roundTo(averageCalories7 - averageCalories30, 1),
    },
    proteinTrend: {
      average7Day: averageProtein7,
      average30Day: averageProtein30,
      difference: roundTo(averageProtein7 - averageProtein30, 1),
    },
    macros: {
      totals: selectedTotals,
      averagesPerLoggedDay: nutrientAverages(
        selectedTotals,
        selectedLoggedDays,
      ),
      calorieSplit: macroCalorieSplit(selectedTotals),
    },
    loggingConsistency: {
      past7Days: { loggedDays: sevenLoggedDays, expectedDays: 7 },
      past30Days: { loggedDays: thirtyLoggedDays, expectedDays: 30 },
    },
    weightTrend: {
      latestWeightLb: latestWeight?.weightLb.toNumber() ?? null,
      latestLoggedAt: latestWeight?.loggedAt.toISOString() ?? null,
      previousWeightLb: previousWeight?.weightLb.toNumber() ?? null,
      previousLoggedAt: previousWeight?.loggedAt.toISOString() ?? null,
      changeLb:
        latestWeight === null || previousWeight === null
          ? null
          : roundTo(
              latestWeight.weightLb.toNumber() -
                previousWeight.weightLb.toNumber(),
              1,
            ),
      weeklySlopeLb: weeklyWeightSlope(weightLogs),
    },
  };
}
