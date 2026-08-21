export interface LocalDateTimeFields {
  date: string;
  time: string;
}

export function formatPresentationDate(
  value: string,
  options: { includeYear?: boolean } = {},
): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(options.includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(date);
}

export function formatPresentationDateRange(
  startDate: string,
  endDate: string,
): string {
  if (startDate === endDate) return formatPresentationDate(startDate);
  return `${formatPresentationDate(startDate)} – ${formatPresentationDate(endDate)}`;
}

function padded(value: number): string {
  return String(value).padStart(2, '0');
}

function datePartsInTimezone(
  value: Date,
  timezone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);

  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  };
}

export function localDateTimeFields(value: string): LocalDateTimeFields {
  const date = new Date(value);

  return {
    date: `${date.getFullYear()}-${padded(date.getMonth() + 1)}-${padded(
      date.getDate(),
    )}`,
    time: `${padded(date.getHours())}:${padded(date.getMinutes())}`,
  };
}

export function dateTimeFieldsInTimezone(
  value: string | Date,
  timezone: string,
): LocalDateTimeFields {
  const parts = datePartsInTimezone(new Date(value), timezone);

  return {
    date: `${parts.year}-${padded(parts.month)}-${padded(parts.day)}`,
    time: `${padded(parts.hour)}:${padded(parts.minute)}`,
  };
}

export function todayInTimezone(timezone: string): string {
  return dateTimeFieldsInTimezone(new Date(), timezone).date;
}

export function addLocalDateDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));

  return `${date.getUTCFullYear()}-${padded(
    date.getUTCMonth() + 1,
  )}-${padded(date.getUTCDate())}`;
}

export function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function isValidLocalTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function localDateTimeToIso(
  dateValue: string,
  timeValue: string,
): string | null {
  if (!isValidLocalDate(dateValue) || !isValidLocalTime(timeValue)) {
    return null;
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const date = new Date(year!, month! - 1, day, hour, minute, 0, 0);

  return date.toISOString();
}

export function zonedDateTimeToIso(
  dateValue: string,
  timeValue: string,
  timezone: string,
): string | null {
  if (!isValidLocalDate(dateValue) || !isValidLocalTime(timeValue)) {
    return null;
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  const targetUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0, 0);
  let candidate = targetUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = datePartsInTimezone(new Date(candidate), timezone);
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const adjustment = targetUtc - representedUtc;

    if (adjustment === 0) {
      break;
    }
    candidate += adjustment;
  }

  return new Date(candidate).toISOString();
}
