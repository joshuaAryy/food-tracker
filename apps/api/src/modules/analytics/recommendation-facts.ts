import { DEFAULT_TIMEZONE, type GoalType } from '@food-tracker/shared';
import {
  addLocalDays,
  localDate,
  localDateDifference,
  localDateRange,
} from '../../lib/dates.js';
import { prisma } from '../../lib/prisma.js';
import { roundTo } from '../../lib/serializers.js';

const DAYS_ANALYZED = 7;

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
  lastWeightLoggedAt: string | null;
  daysSinceLastWeightLog: number | null;
  hasRecentWeightLog: boolean;
}

export async function computeRecommendationFacts(
  userId: string,
  now = new Date(),
): Promise<RecommendationAnalyticsFacts> {
  const [profile, goals] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
    prisma.userGoal.findUnique({ where: { userId } }),
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
      select: { calories: true, protein: true, loggedAt: true },
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

  return {
    timezone,
    currentLocalDate,
    daysAnalyzed: DAYS_ANALYZED,
    targetCalories: goals?.targetCalories ?? null,
    targetProteinGrams: goals?.targetProteinGrams?.toNumber() ?? null,
    goalType: goals?.goalType ?? null,
    averageCalories: roundTo(totalCalories / DAYS_ANALYZED, 0),
    averageProteinGrams: roundTo(totalProtein / DAYS_ANALYZED, 1),
    loggedDays,
    expectedDays: DAYS_ANALYZED,
    missingDays: DAYS_ANALYZED - loggedDays,
    lastWeightLoggedAt: latestWeightLog?.loggedAt.toISOString() ?? null,
    daysSinceLastWeightLog,
    hasRecentWeightLog:
      latestWeightLog !== null &&
      trackingRange.gte !== undefined &&
      latestWeightLog.loggedAt >= trackingRange.gte,
  };
}
