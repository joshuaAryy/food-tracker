import { addLocalDays, localDateDifference } from '../../../lib/dates.js';

export type CalendarGoalDirection = 'lose' | 'maintain' | 'gain';
export type CalendarPhase = 'past' | 'today' | 'future';
export type CalendarMonthRelation = 'previous' | 'current' | 'next';
export type CalendarCalorieStatus =
  | 'not_logged'
  | 'no_target'
  | 'below_range'
  | 'within_range'
  | 'over_range';
export type CalendarStreakState =
  | 'future'
  | 'open'
  | 'missed'
  | 'logged_without_target'
  | 'partial'
  | 'gold'
  | 'over_target'
  | 'grace';

export interface DateBoundary {
  startDate: string;
  endDate: string;
}

export interface CalendarMonthDisplayBoundary {
  month: DateBoundary;
  display: DateBoundary;
  weekCount: number;
}

export interface AcceptedCalorieRange {
  lowerRatio: number;
  upperRatio: number;
  lowerCalories: number;
  upperCalories: number;
}

export interface CalendarDayInput {
  date: string;
  today: string;
  monthStart: string;
  monthEnd: string;
  logged?: boolean;
  calories?: number | null;
  grace?: boolean;
  targetCalories: number | null;
  lowerCalories: number | null;
  upperCalories: number | null;
}

export interface CalendarDayFacts {
  date: string;
  monthRelation: CalendarMonthRelation;
  phase: CalendarPhase;
  logged: boolean;
  grace: boolean;
  missed: boolean;
  open: boolean;
  streakState: CalendarStreakState;
  calories: number | null;
  calorieRatio: number | null;
  calorieStatus: CalendarCalorieStatus;
  goldDay: boolean;
}

const ranges: Record<CalendarGoalDirection, [number, number]> = {
  gain: [0.95, 1.15],
  maintain: [0.9, 1.1],
  lose: [0.85, 1.05],
};

function monthStart(month: string): string {
  return `${month}-01`;
}

function monthEnd(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (monthNumber ?? 1) - 1 + 1, 0))
    .toISOString()
    .slice(0, 10);
}

function validMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function monthDisplayBoundary(
  requestedMonth: string,
): CalendarMonthDisplayBoundary {
  if (!validMonth(requestedMonth)) {
    throw new Error('Month must use YYYY-MM format');
  }
  const startDate = monthStart(requestedMonth);
  const endDate = monthEnd(requestedMonth);
  const startDay = new Date(`${startDate}T00:00:00Z`).getUTCDay();
  const endDay = new Date(`${endDate}T00:00:00Z`).getUTCDay();
  const displayStart = addLocalDays(startDate, -startDay);
  const displayEnd = addLocalDays(endDate, 6 - endDay);
  const totalDays = localDateDifference(displayEnd, displayStart) + 1;

  return {
    month: { startDate, endDate },
    display: { startDate: displayStart, endDate: displayEnd },
    weekCount: totalDays / 7,
  };
}

export function acceptedCalorieRange(
  goalDirection: CalendarGoalDirection | null,
  targetCalories: number | null,
): AcceptedCalorieRange | null {
  if (
    goalDirection === null ||
    targetCalories === null ||
    !Number.isFinite(targetCalories) ||
    targetCalories <= 0
  ) {
    return null;
  }
  const [lowerRatio, upperRatio] = ranges[goalDirection];
  return {
    lowerRatio,
    upperRatio,
    lowerCalories: Math.round(targetCalories * lowerRatio),
    upperCalories: Math.round(targetCalories * upperRatio),
  };
}

function monthRelation(
  date: string,
  monthStartDate: string,
  monthEndDate: string,
): CalendarMonthRelation {
  if (date < monthStartDate) return 'previous';
  if (date > monthEndDate) return 'next';
  return 'current';
}

export function classifyCalendarDay(input: CalendarDayInput): CalendarDayFacts {
  const logged = input.logged ?? false;
  const grace = input.grace ?? false;
  const calories = logged ? (input.calories ?? 0) : null;
  const phase: CalendarPhase =
    input.date < input.today
      ? 'past'
      : input.date > input.today
        ? 'future'
        : 'today';
  const relation = monthRelation(input.date, input.monthStart, input.monthEnd);

  if (phase === 'future') {
    return {
      date: input.date,
      monthRelation: relation,
      phase,
      logged,
      grace,
      missed: false,
      open: false,
      streakState: 'future',
      calories,
      calorieRatio:
        calories === null || input.targetCalories === null
          ? null
          : calories / input.targetCalories,
      calorieStatus: 'not_logged',
      goldDay: false,
    };
  }

  if (grace) {
    return {
      date: input.date,
      monthRelation: relation,
      phase,
      logged: false,
      grace: true,
      missed: false,
      open: false,
      streakState: 'grace',
      calories: null,
      calorieRatio: null,
      calorieStatus: 'not_logged',
      goldDay: false,
    };
  }

  if (!logged) {
    const open = phase === 'today';
    return {
      date: input.date,
      monthRelation: relation,
      phase,
      logged: false,
      grace: false,
      missed: !open,
      open,
      streakState: open ? 'open' : 'missed',
      calories: null,
      calorieRatio: null,
      calorieStatus: 'not_logged',
      goldDay: false,
    };
  }

  if (
    input.targetCalories === null ||
    input.lowerCalories === null ||
    input.upperCalories === null
  ) {
    return {
      date: input.date,
      monthRelation: relation,
      phase,
      logged: true,
      grace,
      missed: false,
      open: false,
      streakState: 'logged_without_target',
      calories,
      calorieRatio: null,
      calorieStatus: 'no_target',
      goldDay: false,
    };
  }

  const recordedCalories = calories ?? 0;
  const ratio = recordedCalories / input.targetCalories;
  const inRange =
    recordedCalories >= input.lowerCalories &&
    recordedCalories <= input.upperCalories;
  const calorieStatus: CalendarCalorieStatus = inRange
    ? 'within_range'
    : recordedCalories < input.lowerCalories
      ? 'below_range'
      : 'over_range';
  const streakState: CalendarStreakState = inRange
    ? 'gold'
    : calorieStatus === 'below_range'
      ? 'partial'
      : 'over_target';

  return {
    date: input.date,
    monthRelation: relation,
    phase,
    logged: true,
    grace,
    missed: false,
    open: false,
    streakState,
    calories,
    calorieRatio: ratio,
    calorieStatus,
    goldDay: inRange && !grace,
  };
}

export function isGoldWeek(goldDays: boolean[]): boolean {
  return goldDays.length === 7 && goldDays.every(Boolean);
}
