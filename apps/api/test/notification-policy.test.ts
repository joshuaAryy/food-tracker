import { describe, expect, it } from 'vitest';
import { notificationEligibility } from '../src/modules/notifications/policy.js';

describe('notification policy', () => {
  it('allows only one claimed opportunity per local date and applies rolling caps', () => {
    const result = notificationEligibility({
      now: new Date('2026-08-29T23:00:00.000Z'),
      timezone: 'America/Toronto',
      localDate: '2026-08-29',
      recommendationEnabled: true,
      reminderEnabled: true,
      todayIncomplete: true,
      lastFoodLogAt: new Date('2026-08-28T20:00:00.000Z'),
      claimedEvents: [],
      activeRecommendation: { id: 'r1', identityKey: 'protein_low' },
    });
    expect(result).toEqual({ kind: 'recommendation', recommendationId: 'r1' });
  });

  it('suppresses inactive users and reminder windows outside local evening', () => {
    const result = notificationEligibility({
      now: new Date('2026-08-29T12:00:00.000Z'),
      timezone: 'America/Toronto',
      localDate: '2026-08-29',
      recommendationEnabled: false,
      reminderEnabled: true,
      todayIncomplete: true,
      lastFoodLogAt: new Date('2026-08-20T20:00:00.000Z'),
      claimedEvents: [],
      activeRecommendation: null,
    });
    expect(result).toEqual({ kind: 'none', reason: 'inactive' });
  });
});
