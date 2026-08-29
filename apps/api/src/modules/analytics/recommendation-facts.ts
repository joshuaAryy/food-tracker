import { DEFAULT_TIMEZONE, type GoalType } from '@food-tracker/shared';
import {
  addLocalDays,
  localDate,
  localDateDifference,
  localDateRange,
} from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { roundTo } from '../../lib/serializers.js';
import { resolveUserNutritionTargets } from '../nutritionTargets/service.js';

const DAYS_ANALYZED = 7;
export const MIN_LOGGED_DAYS_FOR_INTAKE_RECOMMENDATIONS = 4;

export interface RecommendationAnalyticsFacts {
  timezone: string;
  currentLocalDate: string;
  daysAnalyzed: number;
  targetCalories: number | null;
  targetProteinGrams: number | null;
  goalType: GoalType | null;
  averageCalories: number;
  averageProteinGrams: number;
  loggedDays: number;
  expectedDays: number;
  missingDays: number;
  intakeRecommendationsAllowed: boolean;
  lastWeightLoggedAt: string | null;
  daysSinceLastWeightLog: number | null;
  hasRecentWeightLog: boolean;
  micronutrients: Array<{
    nutrientKey: 'vitaminD' | 'calcium' | 'potassium';
    target: number;
    average: number;
    recordedDays: number;
    eligibleDays: number;
    coverage: number;
  }>;
}

export async function computeRecommendationFacts(
  userId: string,
  now = new Date(),
): Promise<RecommendationAnalyticsFacts> {
  const [profile, goals, effectiveTargets] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
    prisma.userGoal.findUnique({ where: { userId } }),
    resolveUserNutritionTargets(userId),
  ]);
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const currentLocalDate = localDate(now, timezone);
  const startDate = addLocalDays(currentLocalDate, -(DAYS_ANALYZED - 1));
  const trackingRange = localDateRange(timezone, {
    startDate,
    endDate: currentLocalDate,
  });
  const [foodLogs, latestWeightLog] = await Promise.all([
    prisma.foodLog.findMany({
      where: { userId, loggedAt: trackingRange },
      select: {
        calories: true,
        protein: true,
        loggedAt: true,
        nutrients: { select: { nutrientKey: true, amount: true } },
      },
    }),
    prisma.weightLog.findFirst({
      where: {
        userId,
        ...(trackingRange.lt === undefined
          ? {}
          : { loggedAt: { lt: trackingRange.lt } }),
      },
      select: { loggedAt: true },
      orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const totalCalories = foodLogs.reduce(
    (total, foodLog) => total + foodLog.calories,
    0,
  );
  const totalProtein = foodLogs.reduce(
    (total, foodLog) => total + foodLog.protein.toNumber(),
    0,
  );
  const loggedLocalDates = new Set(
    foodLogs.map((foodLog) => localDate(foodLog.loggedAt, timezone)),
  );
  const lastWeightLocalDate =
    latestWeightLog === null
      ? null
      : localDate(latestWeightLog.loggedAt, timezone);
  const daysSinceLastWeightLog =
    lastWeightLocalDate === null
      ? null
      : Math.max(0, localDateDifference(currentLocalDate, lastWeightLocalDate));
  const loggedDays = loggedLocalDates.size;
  const micronutrients = (
    ['vitaminD', 'calcium', 'potassium'] as const
  ).flatMap((nutrientKey) => {
    const target = effectiveTargets[nutrientKey]?.effectiveValue;
    if (target === null || target === undefined || target <= 0) return [];
    const byDate = new Map<string, number>();
    for (const foodLog of foodLogs) {
      const amount = foodLog.nutrients
        .filter((nutrient) => nutrient.nutrientKey === nutrientKey)
        .reduce((sum, nutrient) => sum + nutrient.amount.toNumber(), 0);
      if (
        amount > 0 ||
        foodLog.nutrients.some(
          (nutrient) => nutrient.nutrientKey === nutrientKey,
        )
      ) {
        const date = localDate(foodLog.loggedAt, timezone);
        byDate.set(date, (byDate.get(date) ?? 0) + amount);
      }
    }
    const recordedDays = byDate.size;
    if (
      recordedDays < MIN_LOGGED_DAYS_FOR_INTAKE_RECOMMENDATIONS ||
      recordedDays / Math.max(1, loggedDays) < 0.7
    )
      return [];
    return [
      {
        nutrientKey,
        target,
        average: roundTo(
          [...byDate.values()].reduce((sum, value) => sum + value, 0) /
            recordedDays,
          1,
        ),
        recordedDays,
        eligibleDays: loggedDays,
        coverage: recordedDays / Math.max(1, loggedDays),
      },
    ];
  });

  return {
    timezone,
    currentLocalDate,
    daysAnalyzed: DAYS_ANALYZED,
    targetCalories: effectiveTargets.calories?.effectiveValue ?? null,
    targetProteinGrams: effectiveTargets.protein?.effectiveValue ?? null,
    goalType: goals?.goalType ?? null,
    averageCalories: roundTo(totalCalories / DAYS_ANALYZED, 0),
    averageProteinGrams: roundTo(totalProtein / DAYS_ANALYZED, 1),
    loggedDays,
    expectedDays: DAYS_ANALYZED,
    missingDays: DAYS_ANALYZED - loggedDays,
    intakeRecommendationsAllowed:
      loggedDays >= MIN_LOGGED_DAYS_FOR_INTAKE_RECOMMENDATIONS,
    lastWeightLoggedAt: latestWeightLog?.loggedAt.toISOString() ?? null,
    daysSinceLastWeightLog,
    hasRecentWeightLog:
      latestWeightLog !== null &&
      trackingRange.gte !== undefined &&
      latestWeightLog.loggedAt >= trackingRange.gte,
    micronutrients,
  };
}
