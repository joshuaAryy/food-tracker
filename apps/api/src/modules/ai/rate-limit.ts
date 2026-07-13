import { AppError } from '../../lib/errors.js';

interface LimitBucket {
  windowStartedAt: number;
  windowCount: number;
  day: string;
  dayCount: number;
}

const buckets = new Map<string, LimitBucket>();
let lastConfigKey = '';

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function assertAiFoodParseLimit(input: {
  key: string;
  windowMs: number;
  windowMax: number;
  dailyMax: number;
  now?: Date;
  message?: string;
}): void {
  const configKey = `${input.windowMs}:${input.windowMax}:${input.dailyMax}`;
  if (configKey !== lastConfigKey) {
    buckets.clear();
    lastConfigKey = configKey;
  }

  const now = input.now ?? new Date();
  const currentTime = now.getTime();
  const currentDay = dayKey(now);
  const bucket = buckets.get(input.key);
  const nextBucket: LimitBucket =
    bucket === undefined
      ? {
          windowStartedAt: currentTime,
          windowCount: 0,
          day: currentDay,
          dayCount: 0,
        }
      : {
          windowStartedAt:
            currentTime - bucket.windowStartedAt >= input.windowMs
              ? currentTime
              : bucket.windowStartedAt,
          windowCount:
            currentTime - bucket.windowStartedAt >= input.windowMs
              ? 0
              : bucket.windowCount,
          day: bucket.day === currentDay ? bucket.day : currentDay,
          dayCount: bucket.day === currentDay ? bucket.dayCount : 0,
        };

  if (
    nextBucket.windowCount >= input.windowMax ||
    nextBucket.dayCount >= input.dailyMax
  ) {
    throw new AppError(
      429,
      'RATE_LIMITED',
      input.message ??
        'Meal description parsing is temporarily limited. Try again later.',
    );
  }

  nextBucket.windowCount += 1;
  nextBucket.dayCount += 1;
  buckets.set(input.key, nextBucket);
}
