import { localDate } from '../../lib/dates.js';

export interface ClaimedNotificationEvent {
  class: 'recommendation_insight' | 'logging_reminder';
  claimedAt: Date;
  localDate: string;
}

export type NotificationEligibility =
  | { kind: 'recommendation'; recommendationId: string }
  | { kind: 'logging_reminder' }
  | { kind: 'none'; reason: string };

function localHour(now: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(now)
    .find((part) => part.type === 'hour')?.value;
  return Number(hour ?? 0);
}

export function notificationEligibility(input: {
  now: Date;
  timezone: string;
  localDate: string;
  recommendationEnabled: boolean;
  reminderEnabled: boolean;
  todayIncomplete: boolean;
  lastFoodLogAt: Date | null;
  claimedEvents: readonly ClaimedNotificationEvent[];
  activeRecommendation: { id: string; identityKey: string } | null;
}): NotificationEligibility {
  if (
    input.lastFoodLogAt === null ||
    input.now.getTime() - input.lastFoodLogAt.getTime() >= 168 * 60 * 60 * 1000
  ) {
    return { kind: 'none', reason: 'inactive' };
  }
  if (
    input.claimedEvents.some((event) => event.localDate === input.localDate)
  ) {
    return { kind: 'none', reason: 'daily_claimed' };
  }
  const rolling = input.claimedEvents.filter(
    (event) =>
      input.now.getTime() - event.claimedAt.getTime() < 168 * 60 * 60 * 1000,
  );
  if (rolling.length >= 3) return { kind: 'none', reason: 'rolling_cap' };

  const hour = localHour(input.now, input.timezone);
  if (
    input.recommendationEnabled &&
    input.activeRecommendation !== null &&
    hour >= 10 &&
    hour < 21
  ) {
    return {
      kind: 'recommendation',
      recommendationId: input.activeRecommendation.id,
    };
  }
  const reminders = rolling.filter(
    (event) => event.class === 'logging_reminder',
  ).length;
  if (
    input.reminderEnabled &&
    input.todayIncomplete &&
    reminders < 2 &&
    hour >= 18 &&
    hour < 22
  ) {
    return { kind: 'logging_reminder' };
  }
  return { kind: 'none', reason: 'no_eligible_opportunity' };
}

export function notificationLocalDate(now: Date, timezone: string): string {
  return localDate(now, timezone);
}
