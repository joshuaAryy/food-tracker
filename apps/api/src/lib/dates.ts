interface LocalDateRange {
  gte?: Date;
  lt?: Date;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function parseLocalDate(localDate: string): [number, number, number] {
  const [year, month, day] = localDate.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid local date: ${localDate}`);
  }

  return [year, month, day];
}

function dateParts(date: Date, timezone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]),
  );

  return values as unknown as DateParts;
}

function addLocalDays(localDate: string, days: number): string {
  const [year, month, day] = parseLocalDate(localDate);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function localMidnightToUtc(localDate: string, timezone: string): Date {
  const [year, month, day] = parseLocalDate(localDate);
  const target = Date.UTC(year, month - 1, day);
  let instant = target;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = dateParts(new Date(instant), timezone);
    const currentAsUtc = Date.UTC(
      current.year,
      current.month - 1,
      current.day,
      current.hour,
      current.minute,
      current.second,
    );
    instant += target - currentAsUtc;
  }

  return new Date(instant);
}

export function localDate(date: Date, timezone: string): string {
  const parts = dateParts(date, timezone);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

export function localDateRange(
  timezone: string,
  filters: {
    date?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
  },
): LocalDateRange {
  if (filters.date !== undefined) {
    return {
      gte: localMidnightToUtc(filters.date, timezone),
      lt: localMidnightToUtc(addLocalDays(filters.date, 1), timezone),
    };
  }

  return {
    ...(filters.startDate === undefined
      ? {}
      : { gte: localMidnightToUtc(filters.startDate, timezone) }),
    ...(filters.endDate === undefined
      ? {}
      : {
          lt: localMidnightToUtc(addLocalDays(filters.endDate, 1), timezone),
        }),
  };
}
