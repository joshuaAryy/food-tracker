import {
  DEFAULT_TIMEZONE,
  type StreakCalendarResponse,
} from '@food-tracker/shared';
import { prisma } from '../../../lib/prisma.js';
import { addLocalDays, localDate } from '../../../lib/dates.js';
import {
  acceptedCalorieRange,
  classifyCalendarDay,
  isGoldWeek,
  monthDisplayBoundary,
} from './calendar-facts.js';
import {
  calculateStreak,
  deriveGraceDates,
  type ReportingDay,
} from './facts.js';

type CalendarFoodLog = {
  loggedAt: Date;
  calories: number;
};

function datesBetween(startDate: string, endDate: string): string[] {
  const totalDays =
    Math.max(
      0,
      Math.round(
        (Date.parse(`${endDate}T00:00:00Z`) -
          Date.parse(`${startDate}T00:00:00Z`)) /
          86_400_000,
      ),
    ) + 1;
  return Array.from({ length: totalDays }, (_, index) =>
    addLocalDays(startDate, index),
  );
}

function chunk<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, index * size + size),
  );
}

export async function computeStreakCalendar(
  userId: string,
  requestedMonth: string,
  now = new Date(),
): Promise<StreakCalendarResponse> {
  const [profile, goal, foodLogs] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    }),
    prisma.userGoal.findUnique({
      where: { userId },
      select: { goalType: true, targetCalories: true },
    }),
    prisma.foodLog.findMany({
      where: { userId },
      select: { loggedAt: true, calories: true },
      orderBy: { loggedAt: 'asc' },
    }),
  ]);

  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const today = localDate(now, timezone);
  const boundaries = monthDisplayBoundary(requestedMonth);
  const logs = foodLogs as CalendarFoodLog[];
  const loggedDates = logs
    .map((log) => localDate(log.loggedAt, timezone))
    .filter((date) => date <= today);
  const loggedDays: ReportingDay[] = [...new Set(loggedDates)].map((date) => ({
    date,
    logged: true,
  }));
  const graceDates = deriveGraceDates(loggedDays);
  const caloriesByDate = new Map<string, number>();
  for (const log of logs) {
    const date = localDate(log.loggedAt, timezone);
    if (date > today) continue;
    caloriesByDate.set(date, (caloriesByDate.get(date) ?? 0) + log.calories);
  }

  const goalDirection = goal?.goalType ?? null;
  const activeCalorieTarget = goal?.targetCalories ?? null;
  const calorieRange = acceptedCalorieRange(goalDirection, activeCalorieTarget);
  const dates = datesBetween(
    boundaries.display.startDate,
    boundaries.display.endDate,
  );
  const calendarDays = dates.map((date) =>
    classifyCalendarDay({
      date,
      today,
      monthStart: boundaries.month.startDate,
      monthEnd: boundaries.month.endDate,
      logged: caloriesByDate.has(date),
      calories: caloriesByDate.get(date) ?? null,
      grace: graceDates.has(date),
      targetCalories: activeCalorieTarget,
      lowerCalories: calorieRange?.lowerCalories ?? null,
      upperCalories: calorieRange?.upperCalories ?? null,
    }),
  );
  const weeks = chunk(calendarDays, 7).map((days) => ({
    startDate: days[0]?.date ?? boundaries.display.startDate,
    endDate: days.at(-1)?.date ?? boundaries.display.endDate,
    goldWeek: isGoldWeek(days.map((day) => day.goldDay)),
    days,
  }));
  const streak = calculateStreak(loggedDays, today);

  return {
    timezone,
    requestedMonth,
    monthBoundary: boundaries.month,
    displayBoundary: boundaries.display,
    goalDirection,
    activeCalorieTarget,
    acceptedCalorieRange: calorieRange,
    currentStreak: {
      loggedDays: streak.currentLoggedDays,
      spanDays: streak.currentSpanDays,
      longestLoggedDays: streak.longestLoggedDays,
      graceUsed: streak.graceUsed,
      graceDate: streak.graceDate,
      todayLogged: streak.todayLogged,
      todayOpen: streak.todayOpen,
    },
    weeks,
  };
}
