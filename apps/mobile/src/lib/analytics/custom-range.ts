const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0);
}

function dateFromUtcDay(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function normalizeCustomRange({
  startDate,
  endDate,
  firstEligibleDate,
  today,
}: {
  startDate: string;
  endDate: string;
  firstEligibleDate: string;
  today: string;
}): { startDate: string; endDate: string; days: number } {
  const lower = utcDay(firstEligibleDate);
  const upper = utcDay(today);
  const start = Math.min(Math.max(utcDay(startDate), lower), upper);
  const end = Math.min(Math.max(utcDay(endDate), lower), upper);
  const normalizedStart = Math.min(start, end);
  const normalizedEnd = Math.max(start, end);
  return {
    startDate: dateFromUtcDay(normalizedStart),
    endDate: dateFromUtcDay(normalizedEnd),
    days: Math.round((normalizedEnd - normalizedStart) / MS_PER_DAY) + 1,
  };
}

export function customRangeAggregationLabel(
  days: number,
): 'Daily' | 'Weekly' | 'Monthly' {
  if (days <= 45) return 'Daily';
  if (days <= 180) return 'Weekly';
  return 'Monthly';
}
