import { localDate, localDateRange } from '../../src/lib/dates.js';

export const TEST_TIMEZONE = 'America/Toronto';

function addLocalDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid local date: ${date}`);
  }

  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function recentLocalDate(dayOffset = 0): string {
  return addLocalDays(localDate(new Date(), TEST_TIMEZONE), -dayOffset);
}

export function localDateTime(date: string, hourAfterMidnight = 12): string {
  const range = localDateRange(TEST_TIMEZONE, { date });

  if (range.gte === undefined) {
    throw new Error(`Could not create local timestamp for ${date}`);
  }

  return new Date(
    range.gte.getTime() + hourAfterMidnight * 60 * 60 * 1000,
  ).toISOString();
}

export function recentLocalDateTime(
  dayOffset = 0,
  hourAfterMidnight = 12,
): string {
  return localDateTime(recentLocalDate(dayOffset), hourAfterMidnight);
}
