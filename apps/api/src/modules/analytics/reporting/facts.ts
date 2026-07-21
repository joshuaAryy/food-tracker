import { addLocalDays, localDateDifference } from '../../../lib/dates.js';

export interface ReportingDay {
  date: string;
  logged: boolean;
}

export interface StreakFacts {
  currentLoggedDays: number;
  currentSpanDays: number;
  longestLoggedDays: number;
  graceUsed: boolean;
  graceDate: string | null;
  todayLogged: boolean;
  todayOpen: boolean;
}

interface StreakSegment {
  startDate: string;
  endDate: string;
  loggedDays: number;
  graceUsed: boolean;
  graceDate: string | null;
}

function loggedDates(days: ReportingDay[]): string[] {
  return [
    ...new Set(days.filter((day) => day.logged).map((day) => day.date)),
  ].sort();
}

export function deriveGraceDates(days: ReportingDay[]): Set<string> {
  const dates = loggedDates(days);
  const graceDates = new Set<string>();
  let graceUsedInSegment = false;
  let previousDate: string | undefined;

  for (const date of dates) {
    if (previousDate === undefined) {
      previousDate = date;
      graceUsedInSegment = false;
      continue;
    }

    const gap = localDateDifference(date, previousDate);
    if (gap === 1) {
      previousDate = date;
      continue;
    }
    if (gap === 2 && !graceUsedInSegment) {
      graceDates.add(addLocalDays(date, -1));
      graceUsedInSegment = true;
      previousDate = date;
      continue;
    }
    previousDate = date;
    graceUsedInSegment = false;
  }

  return graceDates;
}

function segmentSpan(segment: StreakSegment): number {
  return localDateDifference(segment.endDate, segment.startDate) + 1;
}

export function calculateStreak(
  days: ReportingDay[],
  today: string,
): StreakFacts {
  const dates = loggedDates(days).filter((date) => date <= today);
  const segments: StreakSegment[] = [];

  for (const date of dates) {
    const previous = segments.at(-1);
    if (previous === undefined) {
      segments.push({
        startDate: date,
        endDate: date,
        loggedDays: 1,
        graceUsed: false,
        graceDate: null,
      });
      continue;
    }

    const gap = localDateDifference(date, previous.endDate);
    if (gap === 1) {
      previous.endDate = date;
      previous.loggedDays += 1;
    } else if (gap === 2 && !previous.graceUsed) {
      previous.endDate = date;
      previous.loggedDays += 1;
      previous.graceUsed = true;
      previous.graceDate = addLocalDays(date, -1);
    } else {
      segments.push({
        startDate: date,
        endDate: date,
        loggedDays: 1,
        graceUsed: false,
        graceDate: null,
      });
    }
  }

  const lastDate = dates.at(-1);
  const todayLogged = lastDate === today;
  const todayOpen = !todayLogged;
  const currentSegment =
    lastDate !== undefined && localDateDifference(today, lastDate) <= 2
      ? segments.at(-1)
      : undefined;
  const longest = segments.reduce(
    (best, segment) => (segment.loggedDays > best.loggedDays ? segment : best),
    { loggedDays: 0 } as StreakSegment,
  );

  return {
    currentLoggedDays: currentSegment?.loggedDays ?? 0,
    currentSpanDays:
      currentSegment === undefined ? 0 : segmentSpan(currentSegment),
    longestLoggedDays: longest.loggedDays,
    graceUsed: currentSegment?.graceUsed ?? false,
    graceDate: currentSegment?.graceDate ?? null,
    todayLogged,
    todayOpen,
  };
}

export interface ConsistencyWindow {
  startDate: string;
  endDate: string;
}

export interface ConsistencyFacts {
  eligibleDays: number;
  loggedDays: number;
  percentage: number;
}

export function calculateConsistency(
  days: ReportingDay[],
  window: ConsistencyWindow,
  firstLoggedDate?: string,
): ConsistencyFacts {
  const bounded = days.filter(
    ({ date }) => date >= window.startDate && date <= window.endDate,
  );
  const firstEligibleDate =
    firstLoggedDate ?? bounded.find((day) => day.logged)?.date;
  if (firstEligibleDate === undefined || bounded.length === 0) {
    return { eligibleDays: 0, loggedDays: 0, percentage: 0 };
  }
  const firstLoggedIndex = bounded.findIndex(
    (day) => day.date >= firstEligibleDate,
  );
  if (firstLoggedIndex === -1) {
    return { eligibleDays: 0, loggedDays: 0, percentage: 0 };
  }

  const eligible = bounded.slice(firstLoggedIndex);
  const loggedDays = eligible.filter((day) => day.logged).length;
  return {
    eligibleDays: eligible.length,
    loggedDays,
    percentage: Math.round((loggedDays / eligible.length) * 100),
  };
}
