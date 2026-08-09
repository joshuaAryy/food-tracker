const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CustomRangeSelection {
  startDate: string;
  endDate: string;
  days: number;
}

export interface RailViewport {
  startDate: string;
  endDate: string;
}

function utcDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0);
}

function dateFromUtcDay(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function clampedUtcDay({
  date,
  firstEligibleDate,
  today,
}: {
  date: string;
  firstEligibleDate: string;
  today: string;
}): number {
  return Math.min(
    Math.max(utcDay(date), utcDay(firstEligibleDate)),
    utcDay(today),
  );
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
}): CustomRangeSelection {
  const start = clampedUtcDay({
    date: startDate,
    firstEligibleDate,
    today,
  });
  const end = clampedUtcDay({ date: endDate, firstEligibleDate, today });
  const normalizedStart = Math.min(start, end);
  const normalizedEnd = Math.max(start, end);
  return {
    startDate: dateFromUtcDay(normalizedStart),
    endDate: dateFromUtcDay(normalizedEnd),
    days: Math.round((normalizedEnd - normalizedStart) / MS_PER_DAY) + 1,
  };
}

export function railPositionForDate({
  date,
  firstEligibleDate,
  today,
}: {
  date: string;
  firstEligibleDate: string;
  today: string;
}): number {
  const firstDay = utcDay(firstEligibleDate);
  const lastDay = utcDay(today);
  const span = lastDay - firstDay;
  if (span <= 0) return 0;
  return (clampedUtcDay({ date, firstEligibleDate, today }) - firstDay) / span;
}

export function dateForRailPosition({
  position,
  firstEligibleDate,
  today,
}: {
  position: number;
  firstEligibleDate: string;
  today: string;
}): string {
  const firstDay = utcDay(firstEligibleDate);
  const lastDay = utcDay(today);
  const clampedPosition = Math.min(Math.max(position, 0), 1);
  return dateFromUtcDay(
    Math.round(firstDay + (lastDay - firstDay) * clampedPosition),
  );
}

export function moveCustomRangeHandle({
  handle,
  proposedDate,
  startDate,
  endDate,
  firstEligibleDate,
  today,
}: {
  handle: 'start' | 'end';
  proposedDate: string;
  startDate: string;
  endDate: string;
  firstEligibleDate: string;
  today: string;
}): CustomRangeSelection {
  const current = normalizeCustomRange({
    startDate,
    endDate,
    firstEligibleDate,
    today,
  });
  const proposed = clampedUtcDay({
    date: proposedDate,
    firstEligibleDate,
    today,
  });
  if (handle === 'start') {
    return normalizeCustomRange({
      startDate: dateFromUtcDay(Math.min(proposed, utcDay(current.endDate))),
      endDate: current.endDate,
      firstEligibleDate,
      today,
    });
  }
  return normalizeCustomRange({
    startDate: current.startDate,
    endDate: dateFromUtcDay(Math.max(proposed, utcDay(current.startDate))),
    firstEligibleDate,
    today,
  });
}

/** Exact calendar selection uses the same no-crossing semantics as rail handles. */
export function selectCustomRangeEndpoint({
  endpoint,
  ...selection
}: Omit<Parameters<typeof moveCustomRangeHandle>[0], 'handle'> & {
  endpoint: 'start' | 'end';
}): CustomRangeSelection {
  return moveCustomRangeHandle({
    ...selection,
    handle: endpoint,
  });
}

export function rangeShortcut({
  days,
  firstEligibleDate,
  today,
}: {
  days: number;
  firstEligibleDate: string;
  today: string;
}): CustomRangeSelection {
  const end = utcDay(today);
  return normalizeCustomRange({
    startDate: dateFromUtcDay(end - (Math.max(1, days) - 1) * MS_PER_DAY),
    endDate: today,
    firstEligibleDate,
    today,
  });
}

export function clampRailViewport({
  startDate,
  endDate,
  firstEligibleDate,
  today,
}: {
  startDate: string;
  endDate: string;
  firstEligibleDate: string;
  today: string;
}): RailViewport {
  const selection = normalizeCustomRange({
    startDate,
    endDate,
    firstEligibleDate,
    today,
  });
  return { startDate: selection.startDate, endDate: selection.endDate };
}

export function panRailViewport({
  viewport,
  deltaDays,
  firstEligibleDate,
  today,
}: {
  viewport: RailViewport;
  deltaDays: number;
  firstEligibleDate: string;
  today: string;
}): RailViewport {
  const start = utcDay(viewport.startDate);
  const end = utcDay(viewport.endDate);
  const lower = utcDay(firstEligibleDate);
  const upper = utcDay(today);
  const width = end - start;
  const desiredStart = start + Math.round(deltaDays) * MS_PER_DAY;
  const boundedStart = Math.min(Math.max(desiredStart, lower), upper - width);
  return {
    startDate: dateFromUtcDay(boundedStart),
    endDate: dateFromUtcDay(boundedStart + width),
  };
}

export function zoomRailViewport({
  viewport,
  factor,
  focalDate,
  firstEligibleDate,
  today,
}: {
  viewport: RailViewport;
  factor: number;
  focalDate: string;
  firstEligibleDate: string;
  today: string;
}): RailViewport {
  const start = utcDay(viewport.startDate);
  const end = utcDay(viewport.endDate);
  const lower = utcDay(firstEligibleDate);
  const upper = utcDay(today);
  const spanDays = Math.max(0, Math.round((end - start) / MS_PER_DAY));
  const nextSpanDays = Math.min(
    Math.round((upper - lower) / MS_PER_DAY),
    Math.max(0, Math.floor(spanDays * Math.max(factor, 0))),
  );
  const nextSpan = nextSpanDays * MS_PER_DAY;
  const focal = clampedUtcDay({ date: focalDate, firstEligibleDate, today });
  const desiredStart = focal - Math.round(nextSpan / 2);
  const boundedStart = Math.min(
    Math.max(desiredStart, lower),
    upper - nextSpan,
  );
  return {
    startDate: dateFromUtcDay(boundedStart),
    endDate: dateFromUtcDay(boundedStart + nextSpan),
  };
}

export function customRangeAggregationLabel(
  days: number,
): 'Daily' | 'Weekly' | 'Monthly' {
  if (days <= 45) return 'Daily';
  if (days <= 180) return 'Weekly';
  return 'Monthly';
}
