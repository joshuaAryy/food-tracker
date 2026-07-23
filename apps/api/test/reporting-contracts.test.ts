import { describe, expect, it } from 'vitest';
import {
  reportsResponseSchema,
  streakCalendarResponseSchema,
} from '@food-tracker/shared';

describe('reporting contracts', () => {
  it('accepts an unavailable metric without exposing a user-facing reason', () => {
    const result =
      reportsResponseSchema.shape.current.shape.calorieAdherence.safeParse({
        available: false,
        reason: 'minimum_logged_days',
      });

    expect(result.success).toBe(true);
  });

  it('accepts the focused Sunday-Saturday streak calendar contract', () => {
    const result = streakCalendarResponseSchema.safeParse({
      timezone: 'America/Toronto',
      requestedMonth: '2026-07',
      monthBoundary: { startDate: '2026-07-01', endDate: '2026-07-31' },
      displayBoundary: { startDate: '2026-06-28', endDate: '2026-08-01' },
      goalDirection: 'maintain',
      activeCalorieTarget: 2000,
      acceptedCalorieRange: {
        lowerRatio: 0.9,
        upperRatio: 1.1,
        lowerCalories: 1800,
        upperCalories: 2200,
      },
      currentStreak: {
        loggedDays: 3,
        spanDays: 4,
        longestLoggedDays: 5,
        graceUsed: true,
        graceDate: '2026-07-03',
        todayLogged: true,
        todayOpen: false,
      },
      weeks: [
        {
          startDate: '2026-06-28',
          endDate: '2026-07-04',
          goldWeek: false,
          days: Array.from({ length: 7 }, (_, index) => ({
            date: `2026-06-${String(28 + index).padStart(2, '0')}`,
            monthRelation: index === 0 ? 'previous' : 'current',
            phase: 'past',
            logged: true,
            grace: false,
            missed: false,
            open: false,
            streakState: 'gold',
            calories: 2000,
            calorieRatio: 1,
            calorieStatus: 'within_range',
            goldDay: true,
          })),
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
