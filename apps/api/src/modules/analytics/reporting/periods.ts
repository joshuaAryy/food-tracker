import { addLocalDays, localDateDifference } from '../../../lib/dates.js';

export type ReportPeriod = 'week' | 'month';

export interface DateBoundary {
  startDate: string;
  endDate: string;
}

export interface PeriodBoundary extends DateBoundary {
  elapsedThroughDate: string;
}

export interface PeriodBoundaries {
  current: PeriodBoundary;
  previousCompleted: PeriodBoundary;
}

export interface ComparisonWindows {
  current: DateBoundary;
  previousEquivalent: DateBoundary;
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function monthEnd(date: string): string {
  const nextMonth = addLocalDays(
    `${date.slice(0, 4)}-${date.slice(5, 7)}-01`,
    32,
  ).slice(0, 7);
  return addLocalDays(`${nextMonth}-01`, -1);
}

function previousMonthStart(date: string): string {
  return addLocalDays(monthStart(date), -1).slice(0, 7) + '-01';
}

export function periodBoundaries(
  period: ReportPeriod,
  elapsedThroughDate: string,
): PeriodBoundaries {
  if (period === 'month') {
    const currentStart = monthStart(elapsedThroughDate);
    const previousStart = previousMonthStart(elapsedThroughDate);
    const previousEnd = monthEnd(previousStart);

    return {
      current: {
        startDate: currentStart,
        endDate: monthEnd(elapsedThroughDate),
        elapsedThroughDate,
      },
      previousCompleted: {
        startDate: previousStart,
        endDate: previousEnd,
        elapsedThroughDate: previousEnd,
      },
    };
  }

  const dayOfWeek = new Date(`${elapsedThroughDate}T00:00:00Z`).getUTCDay();
  const currentStart = addLocalDays(elapsedThroughDate, -dayOfWeek);
  const previousStart = addLocalDays(currentStart, -7);
  const previousEnd = addLocalDays(previousStart, 6);

  return {
    current: {
      startDate: currentStart,
      endDate: addLocalDays(currentStart, 6),
      elapsedThroughDate,
    },
    previousCompleted: {
      startDate: previousStart,
      endDate: previousEnd,
      elapsedThroughDate: previousEnd,
    },
  };
}

export function comparisonWindows(
  period: ReportPeriod,
  elapsedThroughDate: string,
): ComparisonWindows {
  const boundaries = periodBoundaries(period, elapsedThroughDate);
  const current: DateBoundary = {
    startDate: boundaries.current.startDate,
    endDate: elapsedThroughDate,
  };

  if (period === 'week') {
    const elapsedDays = localDateDifference(
      elapsedThroughDate,
      boundaries.current.startDate,
    );
    return {
      current,
      previousEquivalent: {
        startDate: boundaries.previousCompleted.startDate,
        endDate: addLocalDays(
          boundaries.previousCompleted.startDate,
          elapsedDays,
        ),
      },
    };
  }

  const elapsedDayOfMonth = Number(elapsedThroughDate.slice(8, 10));
  const previousEnd = boundaries.previousCompleted.endDate;
  const cappedDay = Math.min(
    elapsedDayOfMonth,
    Number(previousEnd.slice(8, 10)),
  );
  return {
    current,
    previousEquivalent: {
      startDate: boundaries.previousCompleted.startDate,
      endDate: `${previousEnd.slice(0, 8)}${String(cappedDay).padStart(2, '0')}`,
    },
  };
}
