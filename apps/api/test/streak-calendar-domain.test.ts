import { describe, expect, it } from 'vitest';
import {
  acceptedCalorieRange,
  classifyCalendarDay,
  monthDisplayBoundary,
  isGoldWeek,
} from '../src/modules/analytics/reporting/calendar-facts.js';
import { deriveGraceDates } from '../src/modules/analytics/reporting/facts.js';

describe('streak calendar domain facts', () => {
  it('pads a leap-year February to complete Sunday-Saturday weeks', () => {
    expect(monthDisplayBoundary('2024-02')).toEqual({
      month: { startDate: '2024-02-01', endDate: '2024-02-29' },
      display: { startDate: '2024-01-28', endDate: '2024-03-02' },
      weekCount: 5,
    });
  });

  it('pads a six-week month without changing the Sunday-Saturday contract', () => {
    expect(monthDisplayBoundary('2026-08')).toEqual({
      month: { startDate: '2026-08-01', endDate: '2026-08-31' },
      display: { startDate: '2026-07-26', endDate: '2026-09-05' },
      weekCount: 6,
    });
  });

  it('uses goal-specific inclusive calorie ranges', () => {
    expect(acceptedCalorieRange('lose', 2000)).toEqual({
      lowerRatio: 0.85,
      upperRatio: 1.05,
      lowerCalories: 1700,
      upperCalories: 2100,
    });
    expect(acceptedCalorieRange('maintain', 2000)).toEqual({
      lowerRatio: 0.9,
      upperRatio: 1.1,
      lowerCalories: 1800,
      upperCalories: 2200,
    });
    expect(acceptedCalorieRange('gain', 2000)).toEqual({
      lowerRatio: 0.95,
      upperRatio: 1.15,
      lowerCalories: 1900,
      upperCalories: 2300,
    });
    expect(acceptedCalorieRange(null, 2000)).toBeNull();
    expect(acceptedCalorieRange('maintain', null)).toBeNull();
  });

  it('distinguishes future, open, missed, grace, partial, gold, over, and no-target days', () => {
    const base = {
      today: '2026-07-15',
      monthStart: '2026-07-01',
      monthEnd: '2026-07-31',
      targetCalories: 2000,
      lowerCalories: 1800,
      upperCalories: 2200,
    };

    expect(classifyCalendarDay({ ...base, date: '2026-07-16' })).toMatchObject({
      phase: 'future',
      streakState: 'future',
      calorieStatus: 'not_logged',
      goldDay: false,
    });
    expect(classifyCalendarDay({ ...base, date: '2026-07-15' })).toMatchObject({
      phase: 'today',
      streakState: 'open',
      open: true,
    });
    expect(classifyCalendarDay({ ...base, date: '2026-07-14' })).toMatchObject({
      streakState: 'missed',
      missed: true,
    });
    expect(
      classifyCalendarDay({
        ...base,
        date: '2026-07-13',
        logged: true,
        calories: 1900,
        grace: true,
      }),
    ).toMatchObject({ streakState: 'grace', grace: true, goldDay: false });
    expect(
      classifyCalendarDay({
        ...base,
        date: '2026-07-12',
        logged: true,
        calories: 1700,
      }),
    ).toMatchObject({ streakState: 'partial', calorieStatus: 'below_range' });
    expect(
      classifyCalendarDay({
        ...base,
        date: '2026-07-11',
        logged: true,
        calories: 2000,
      }),
    ).toMatchObject({ streakState: 'gold', goldDay: true });
    expect(
      classifyCalendarDay({
        ...base,
        date: '2026-07-10',
        logged: true,
        calories: 2300,
      }),
    ).toMatchObject({
      streakState: 'over_target',
      calorieStatus: 'over_range',
    });
    expect(
      classifyCalendarDay({
        ...base,
        date: '2026-07-09',
        logged: true,
        calories: 2000,
        targetCalories: null,
        lowerCalories: null,
        upperCalories: null,
      }),
    ).toMatchObject({
      streakState: 'logged_without_target',
      calorieStatus: 'no_target',
      goldDay: false,
    });

    expect(
      classifyCalendarDay({
        ...base,
        date: '2026-07-08',
        logged: true,
        calories: 1800,
      }),
    ).toMatchObject({
      streakState: 'gold',
      calorieStatus: 'within_range',
      goldDay: true,
    });
    expect(
      classifyCalendarDay({
        ...base,
        date: '2026-07-07',
        logged: true,
        calories: 2200,
      }),
    ).toMatchObject({
      streakState: 'gold',
      calorieStatus: 'within_range',
      goldDay: true,
    });
    expect(
      classifyCalendarDay({
        ...base,
        date: '2026-07-06',
        logged: true,
        calories: Number.MAX_SAFE_INTEGER,
      }),
    ).toMatchObject({
      streakState: 'over_target',
      calorieStatus: 'over_range',
      goldDay: false,
    });
  });

  it('requires seven independently gold days for a gold week', () => {
    expect(isGoldWeek(Array(7).fill(true))).toBe(true);
    expect(isGoldWeek([true, true, true, true, true, true, false])).toBe(false);
  });

  it('rejects every open, future, missed, partial, over, grace, and no-target day from a gold week', () => {
    const base = {
      today: '2026-07-15',
      monthStart: '2026-07-01',
      monthEnd: '2026-07-31',
      targetCalories: 2000,
      lowerCalories: 1800,
      upperCalories: 2200,
    };
    const nonGoldDays = [
      classifyCalendarDay({ ...base, date: '2026-07-16' }),
      classifyCalendarDay({ ...base, date: '2026-07-15' }),
      classifyCalendarDay({ ...base, date: '2026-07-14' }),
      classifyCalendarDay({
        ...base,
        date: '2026-07-13',
        logged: true,
        calories: 1700,
      }),
      classifyCalendarDay({
        ...base,
        date: '2026-07-12',
        logged: true,
        calories: 2300,
      }),
      classifyCalendarDay({ ...base, date: '2026-07-11', grace: true }),
      classifyCalendarDay({
        ...base,
        date: '2026-07-10',
        logged: true,
        calories: 2000,
        targetCalories: null,
        lowerCalories: null,
        upperCalories: null,
      }),
    ];

    expect(nonGoldDays.every((day) => !day.goldDay)).toBe(true);
    expect(isGoldWeek(nonGoldDays.map((day) => day.goldDay))).toBe(false);
  });

  it('derives authoritative historical grace dates from one-day gaps', () => {
    expect(
      deriveGraceDates([
        { date: '2026-07-10', logged: true },
        { date: '2026-07-12', logged: true },
        { date: '2026-07-15', logged: true },
      ]),
    ).toEqual(new Set(['2026-07-11']));
  });
});
