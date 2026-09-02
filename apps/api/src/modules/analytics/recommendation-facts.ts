import {
  DEFAULT_TIMEZONE,
  type GoalType,
  type TrackingMode,
} from '@food-tracker/shared';
import {
  addLocalDays,
  localDate,
  localDateDifference,
  localDateRange,
} from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { roundTo } from '../../lib/serializers.js';
import { resolveUserNutritionTargets } from '../nutritionTargets/service.js';
import { calculateAge } from '../personalization/resolver.js';
import { isDriDataComparable } from '../nutritionTargets/dri-reference.js';

const DAYS_ANALYZED = 7;
export const MIN_LOGGED_DAYS_FOR_INTAKE_RECOMMENDATIONS = 4;

export interface RecommendationAnalyticsFacts {
  timezone: string;
  currentLocalDate: string;
  daysAnalyzed: number;
  targetCalories: number | null;
  targetCaloriesSource: string | null;
  targetProteinGrams: number | null;
  targetProteinSource: string | null;
  goalType: GoalType | null;
  targetWeightLb: number | null;
  targetRateLbPerWeek: number | null;
  trackingMode: TrackingMode;
  currentWeightLb: number | null;
  weightTrendLbPerWeek: number | null;
  averageCalories: number;
  averageProteinGrams: number;
  loggedDays: number;
  expectedDays: number;
  missingDays: number;
  intakeRecommendationsAllowed: boolean;
  lastWeightLoggedAt: string | null;
  daysSinceLastWeightLog: number | null;
  hasRecentWeightLog: boolean;
  hydration: {
    averageMl: number;
    recordedDays: number;
    eligibleDays: number;
  };
  micronutrients: Array<{
    nutrientKey: 'vitaminD' | 'calcium' | 'potassium';
    target: number;
    average: number;
    recordedDays: number;
    eligibleDays: number;
    coverage: number;
    targetSource: string;
    referenceVersion: string | null;
  }>;
}

export async function computeRecommendationFacts(
  userId: string,
  now = new Date(),
): Promise<RecommendationAnalyticsFacts> {
  const [profile, goals, preferences, effectiveTargets] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true, birthDate: true },
    }),
    prisma.userGoal.findUnique({ where: { userId } }),
    prisma.trackingPreference.findUnique({
      where: { userId },
      select: { mode: true },
    }),
    resolveUserNutritionTargets(userId, now),
  ]);
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const completedAge =
    profile?.birthDate === null || profile?.birthDate === undefined
      ? null
      : calculateAge(
          profile.birthDate.toISOString().slice(0, 10),
          now,
          timezone,
        );
  const currentLocalDate = localDate(now, timezone);
  const startDate = addLocalDays(currentLocalDate, -(DAYS_ANALYZED - 1));
  const trackingRange = localDateRange(timezone, {
    startDate,
    endDate: currentLocalDate,
  });
  const [foodLogs, latestWeightLog, weightLogs, waterLogs] = await Promise.all([
    prisma.foodLog.findMany({
      where: { userId, loggedAt: trackingRange },
      select: {
        calories: true,
        protein: true,
        loggedAt: true,
        foodItem: { select: { sourceProvider: true } },
        nutrients: { select: { nutrientKey: true, amount: true, unit: true } },
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
      orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.weightLog.findMany({
      where: { userId, loggedAt: trackingRange },
      select: { weightLb: true, loggedAt: true },
      orderBy: [{ loggedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.waterLog.findMany({
      where: { userId, loggedAt: trackingRange },
      select: { amountMl: true, loggedAt: true },
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
  const waterByDate = new Map<string, number>();
  for (const waterLog of waterLogs) {
    const date = localDate(waterLog.loggedAt, timezone);
    waterByDate.set(date, (waterByDate.get(date) ?? 0) + waterLog.amountMl);
  }
  const weightTrendLbPerWeek =
    weightLogs.length >= 2
      ? roundTo(
          (((weightLogs.at(-1)?.weightLb.toNumber() ?? 0) -
            (weightLogs[0]?.weightLb.toNumber() ?? 0)) /
            Math.max(
              1 / 7,
              (weightLogs.at(-1)?.loggedAt.getTime() ?? 0) -
                (weightLogs[0]?.loggedAt.getTime() ?? 0),
            )) *
            7 *
            24 *
            60 *
            60 *
            1000,
          2,
        )
      : null;
  const micronutrients = (
    preferences?.mode === 'complex'
      ? (['vitaminD', 'calcium', 'potassium'] as const)
      : []
  ).flatMap((nutrientKey) => {
    const target = effectiveTargets[nutrientKey]?.effectiveValue;
    if (target === null || target === undefined || target <= 0) return [];
    const byDate = new Map<string, number>();
    for (const foodLog of foodLogs) {
      const comparableNutrients = foodLog.nutrients.filter(
        (nutrient) =>
          nutrient.nutrientKey === nutrientKey &&
          isDriDataComparable(
            nutrientKey,
            foodLog.foodItem?.sourceProvider,
            nutrient.unit,
          ),
      );
      // An incompatible provider is still trackable, but it cannot count as
      // an observed DRI-comparable intake day. In particular, do not let the
      // presence of an incompatible row be mistaken for a recorded zero.
      if (comparableNutrients.length === 0) continue;
      const amount = comparableNutrients
        .filter((nutrient) => nutrient.nutrientKey === nutrientKey)
        .reduce((sum, nutrient) => sum + nutrient.amount.toNumber(), 0);
      const date = localDate(foodLog.loggedAt, timezone);
      byDate.set(date, (byDate.get(date) ?? 0) + amount);
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
        targetSource:
          effectiveTargets[nutrientKey]?.effectiveSource ?? 'missing',
        referenceVersion:
          effectiveTargets[nutrientKey]?.recommendedSource === 'reference'
            ? 'health_canada_dri_2023'
            : null,
      },
    ];
  });

  return {
    timezone,
    currentLocalDate,
    daysAnalyzed: DAYS_ANALYZED,
    targetCalories: effectiveTargets.calories?.effectiveValue ?? null,
    targetCaloriesSource: effectiveTargets.calories?.effectiveSource ?? null,
    targetProteinGrams: effectiveTargets.protein?.effectiveValue ?? null,
    targetProteinSource: effectiveTargets.protein?.effectiveSource ?? null,
    goalType: goals?.goalType ?? null,
    targetWeightLb: goals?.targetWeightLb?.toNumber() ?? null,
    targetRateLbPerWeek:
      completedAge !== null && completedAge >= 19
        ? (goals?.targetRateLbPerWeek?.toNumber() ?? null)
        : null,
    trackingMode: preferences?.mode ?? 'simple',
    currentWeightLb: weightLogs.at(-1)?.weightLb.toNumber() ?? null,
    weightTrendLbPerWeek,
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
    hydration: {
      averageMl:
        waterByDate.size === 0
          ? 0
          : roundTo(
              [...waterByDate.values()].reduce((sum, value) => sum + value, 0) /
                waterByDate.size,
              0,
            ),
      recordedDays: waterByDate.size,
      eligibleDays: loggedDays,
    },
    micronutrients,
  };
}
