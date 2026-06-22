export interface LocalDateTimeFields {
  date: string;
  time: string;
}

function padded(value: number): string {
  return String(value).padStart(2, '0');
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
