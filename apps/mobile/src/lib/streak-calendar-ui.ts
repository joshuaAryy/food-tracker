import type { StreakCalendarResponse } from '@food-tracker/shared';

export const STREAKS_ROUTE = '/streaks' as const;
export const DAY_CELL_SIZE = 44;
export const DAY_RING_SIZE = 34;
export const DAY_RING_STROKE = 3;

export type StreakCalendarDay =
  StreakCalendarResponse['weeks'][number]['days'][number];

export type CalendarDayVisual =
  | 'plain'
  | 'dotted'
  | 'green-progress'
  | 'green-complete'
  | 'gold'
  | 'over-target'
  | 'grace';

export interface CalendarDayAppearance {
  visual: CalendarDayVisual;
}

export interface StreakDayDetailFacts {
  fullDate: string;
  caloriesLogged: string;
  activeTarget: string;
  acceptedRange: string;
  status: string;
  targetDifference: string;
  loggedMeaning: string;
  goldMeaning: string;
  perfectWeekMeaning: string;
  graceExplanation: string | null;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

export function consumingCharcoalFraction(
  recordedRatio: number | null,
  backendUpperRatio: number,
): number {
  if (recordedRatio === null || !Number.isFinite(recordedRatio)) return 0;
  const rawFraction = (recordedRatio - backendUpperRatio) / 0.2;
  if (rawFraction >= 1 - 1e-9) return 1;
  return clamp(rawFraction);
}

export const darkFraction = consumingCharcoalFraction;

export function isPreTrackingCalendar(
  calendar: Pick<StreakCalendarResponse, 'currentStreak'>,
): boolean {
  return calendar.currentStreak.longestLoggedDays === 0;
}

export function calendarDayAppearance(
  day: StreakCalendarDay,
  preTracking = false,
): CalendarDayAppearance {
  if (preTracking) return { visual: 'plain' };

  switch (day.streakState) {
    case 'future':
    case 'open':
    case 'missed':
      return { visual: 'dotted' };
    case 'logged_without_target':
      return { visual: 'green-complete' };
    case 'partial':
      return { visual: 'green-progress' };
    case 'gold':
      return { visual: 'gold' };
    case 'over_target':
      return { visual: 'over-target' };
    case 'grace':
      return { visual: 'grace' };
  }
}

export function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split('-');
  const value = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1),
  );
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function fullDisplayDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function formatCalories(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value).toLocaleString('en-US')} kcal`;
}

function calendarStatus(day: StreakCalendarDay): string {
  switch (day.streakState) {
    case 'future':
      return 'Future day';
    case 'open':
      return 'Open for logging';
    case 'missed':
      return 'Missed day';
    case 'grace':
      return 'Grace day';
    case 'logged_without_target':
      return 'Target not set';
    case 'partial':
      return 'Below target range';
    case 'gold':
      return 'Within target range';
    case 'over_target':
      return 'Above target range';
  }
}

function loggedMeaning(day: StreakCalendarDay): string {
  switch (day.streakState) {
    case 'future':
      return 'Future dates are excluded from streak evaluation.';
    case 'open':
      return 'Today remains non-breaking until the local day ends.';
    case 'missed':
      return 'Breaks logging continuity.';
    case 'grace':
      return 'Preserves the streak span without adding a logged day.';
    default:
      return 'Counts as a logged day.';
  }
}

function goldMeaning(day: StreakCalendarDay): string {
  if (day.goldDay) return 'Counts as a gold day.';
  if (day.streakState === 'grace') return 'Grace days are never gold.';
  if (day.calorieStatus === 'no_target') {
    return 'Not a gold day because no target is set.';
  }
  if (day.logged) {
    return 'Not a gold day because calories were outside the accepted range.';
  }
  return 'Not a gold day.';
}

export function dayDetailFacts(
  day: StreakCalendarDay,
  activeCalorieTarget: number | null,
  acceptedCalorieRange: StreakCalendarResponse['acceptedCalorieRange'],
  goldWeek: boolean,
): StreakDayDetailFacts {
  const difference =
    day.calories === null || activeCalorieTarget === null
      ? null
      : activeCalorieTarget - day.calories;

  return {
    fullDate: fullDisplayDate(day.date),
    caloriesLogged: formatCalories(day.calories),
    activeTarget: formatCalories(activeCalorieTarget),
    acceptedRange:
      acceptedCalorieRange === null
        ? '—'
        : `${formatCalories(acceptedCalorieRange.lowerCalories).replace(' kcal', '')}–${formatCalories(acceptedCalorieRange.upperCalories)}`,
    status: calendarStatus(day),
    targetDifference:
      difference === null
        ? '—'
        : difference === 0
          ? 'On target'
          : difference > 0
            ? `${Math.round(difference).toLocaleString('en-US')} kcal remaining to target`
            : `${Math.round(Math.abs(difference)).toLocaleString('en-US')} kcal above target`,
    loggedMeaning: loggedMeaning(day),
    goldMeaning: goldMeaning(day),
    perfectWeekMeaning:
      goldWeek && day.goldDay
        ? 'Contributes to this perfect week.'
        : 'Does not contribute to a perfect week.',
    graceExplanation:
      day.streakState === 'grace'
        ? 'A grace day bridges one missed day in the streak span.'
        : null,
  };
}

const stateWords: Record<StreakCalendarDay['streakState'], string> = {
  future: 'future and excluded from streak evaluation',
  open: 'open for logging; today remains non-breaking until the local day ends',
  missed: 'missed; breaks logging continuity and cannot be gold',
  logged_without_target:
    'logged without a calorie target; counts for logging but not gold',
  partial: 'partial, below the accepted calorie range; logged but not gold',
  gold: 'gold, inside the accepted calorie range; counts for logging and gold weeks',
  over_target:
    'over target, above the accepted calorie range; logged but not gold',
  grace:
    'grace day; preserves span continuity without increasing logged-day count and is never gold',
};

export function semanticDayLabel(day: StreakCalendarDay): string {
  const calories = day.calories === null ? '' : `, ${day.calories} kcal`;
  return `${displayDate(day.date)}, ${day.phase}, ${stateWords[day.streakState]}${calories}`;
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00.000Z`));
}

export function shortDayNumber(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00.000Z`));
}

export function shortWeekday(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00.000Z`));
}
