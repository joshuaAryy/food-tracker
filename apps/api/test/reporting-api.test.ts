import { reportsResponseSchema } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { localDateRange } from '../src/lib/dates.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import {
  seedFoodLog,
  seedGoals,
  seedPreferences,
  seedProfile,
} from './helpers/seeds.js';

async function timestampFor(timezone: string, date: string): Promise<Date> {
  const range = localDateRange(timezone, { date });
  if (range.gte === undefined) throw new Error('Missing local date boundary');
  return range.gte;
}

describe('reporting API', () => {
  it('returns independently available empty progress sections without requiring a goal', async () => {
    await seedProfile();
    await seedPreferences();

    const response = await api
      .get('/api/v1/analytics/progress')
      .query({ date: '2026-07-15' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.currentStreak.loggedDays).toBe(0);
    expect(response.body.data.calorieAdherence.available).toBe(false);
    expect(response.body.data.weight.available).toBe(false);
  });

  it('uses the Sunday week and exposes full previous plus equivalent comparison boundaries', async () => {
    await seedProfile();
    await seedGoals({ targetCalories: 2000, targetProteinGrams: 100 });
    await seedPreferences();
    await Promise.all(
      ['2026-07-12', '2026-07-13', '2026-07-14'].map(async (date) =>
        seedFoodLog({
          loggedAt: await timestampFor('America/Toronto', date),
          calories: 2000,
          protein: 100,
        }),
      ),
    );

    const response = await api
      .get('/api/v1/analytics/reports')
      .query({ period: 'week', date: '2026-07-15' })
      .expect(200);
    const parsed = reportsResponseSchema.parse(response.body.data);

    expect(parsed.current.boundaries).toEqual({
      startDate: '2026-07-12',
      endDate: '2026-07-18',
      elapsedThroughDate: '2026-07-15',
    });
    expect(parsed.previousCompleted.boundaries.startDate).toBe('2026-07-05');
    expect(parsed.comparison).toMatchObject({
      currentBoundary: { startDate: '2026-07-12', endDate: '2026-07-15' },
      previousEquivalentBoundary: {
        startDate: '2026-07-05',
        endDate: '2026-07-08',
      },
    });
  });

  it("does not include another user's food log", async () => {
    await seedProfile();
    await seedFoodLog({
      loggedAt: await timestampFor('America/Toronto', '2026-07-15'),
    });
    const otherUser = await prisma.user.create({
      data: { email: 'other@example.com' },
    });
    await prisma.foodLog.create({
      data: {
        userId: otherUser.id,
        foodName: 'Other user',
        mealType: 'lunch',
        calories: 999,
        protein: 99,
        loggedAt: await timestampFor('America/Toronto', '2026-07-15'),
      },
    });

    const response = await api
      .get('/api/v1/analytics/progress')
      .query({ date: '2026-07-15' })
      .expect(200);

    expect(response.body.data.currentStreak.loggedDays).toBe(1);
    expect(response.body.data.currentStreak.longestLoggedDays).toBe(1);
    expect(response.body.data.currentStreak).not.toHaveProperty('otherUser');
  });

  it('rejects missing or invalid report periods', async () => {
    const missing = await api.get('/api/v1/analytics/reports').expect(400);
    expectErrorEnvelope(missing.body, 'VALIDATION_ERROR');

    const invalid = await api
      .get('/api/v1/analytics/reports')
      .query({ period: 'quarter' })
      .expect(400);
    expectErrorEnvelope(invalid.body, 'VALIDATION_ERROR');
  });

  it('keeps calorie and protein adherence independent at exact thresholds', async () => {
    await seedProfile();
    await seedGoals({
      goalType: 'maintain',
      targetCalories: 2000,
      targetProteinGrams: 100,
    });
    await seedPreferences();
    await Promise.all(
      ['2026-07-12', '2026-07-13', '2026-07-14'].map(async (date, index) =>
        seedFoodLog({
          loggedAt: await timestampFor('America/Toronto', date),
          calories: index === 0 ? 1799 : 2000,
          protein: index === 0 ? 89 : 90,
        }),
      ),
    );

    const response = await api
      .get('/api/v1/analytics/reports')
      .query({ period: 'week', date: '2026-07-15' })
      .expect(200);

    expect(response.body.data.current.calorieAdherence.value.adherentDays).toBe(
      2,
    );
    expect(response.body.data.current.proteinAdherence.value.adherentDays).toBe(
      2,
    );
    expect(response.body.data.current.proteinAdherence.value.percentage).toBe(
      89.7,
    );
  });

  it('returns equivalent monthly comparison boundaries for a shorter February', async () => {
    await seedProfile();
    await seedGoals();
    await seedPreferences();
    const response = await api
      .get('/api/v1/analytics/reports')
      .query({ period: 'month', date: '2023-03-31' })
      .expect(200);

    expect(response.body.data.comparison).toMatchObject({
      currentBoundary: { startDate: '2023-03-01', endDate: '2023-03-31' },
      previousEquivalentBoundary: {
        startDate: '2023-02-01',
        endDate: '2023-02-28',
      },
    });
  });

  it('recalculates streak facts after backdating and deleting the final log for a day', async () => {
    await seedProfile();
    const log = await seedFoodLog({
      loggedAt: await timestampFor('America/Toronto', '2026-07-15'),
    });

    expect(
      (
        await api
          .get('/api/v1/analytics/progress')
          .query({ date: '2026-07-15' })
      ).body.data.currentStreak,
    ).toMatchObject({ loggedDays: 1, longestLoggedDays: 1 });

    await prisma.foodLog.update({
      where: { id: log.id },
      data: { loggedAt: await timestampFor('America/Toronto', '2026-07-14') },
    });
    expect(
      (
        await api
          .get('/api/v1/analytics/progress')
          .query({ date: '2026-07-15' })
      ).body.data.currentStreak,
    ).toMatchObject({ loggedDays: 1, todayLogged: false, todayOpen: true });

    await prisma.foodLog.delete({ where: { id: log.id } });
    expect(
      (
        await api
          .get('/api/v1/analytics/progress')
          .query({ date: '2026-07-15' })
      ).body.data.currentStreak,
    ).toMatchObject({ loggedDays: 0, longestLoggedDays: 0 });
  });

  it('keeps goal-dependent adherence unavailable while showing unrelated streak and weight facts', async () => {
    await seedProfile();
    await seedFoodLog({
      loggedAt: await timestampFor('America/Toronto', '2026-07-15'),
    });
    await prisma.weightLog.create({
      data: {
        userId: (await prisma.userProfile.findFirstOrThrow()).userId,
        weightLb: 180,
        loggedAt: await timestampFor('America/Toronto', '2026-07-15'),
      },
    });

    const response = await api
      .get('/api/v1/analytics/progress')
      .query({ date: '2026-07-15' })
      .expect(200);

    expect(response.body.data.currentStreak.loggedDays).toBe(1);
    expect(response.body.data.calorieAdherence).toMatchObject({
      available: false,
      reason: 'missing_goal',
    });
    expect(response.body.data.weight).toMatchObject({
      available: true,
      value: { latestWeightLb: 180 },
    });
  });

  it('uses local dates across the spring DST transition', async () => {
    await seedProfile({ timezone: 'America/Toronto' });
    const first = await timestampFor('America/Toronto', '2026-03-08');
    const second = await timestampFor('America/Toronto', '2026-03-09');
    await seedFoodLog({ loggedAt: first });
    await seedFoodLog({ loggedAt: second });

    const response = await api
      .get('/api/v1/analytics/progress')
      .query({ date: '2026-03-09' })
      .expect(200);

    expect(response.body.data.currentStreak).toMatchObject({
      loggedDays: 2,
      longestLoggedDays: 2,
      todayLogged: true,
    });
  });

  it('gates comparison metrics when the equivalent elapsed window misses its threshold', async () => {
    await seedProfile();
    await seedGoals({ targetCalories: 2000, targetProteinGrams: 100 });
    await Promise.all(
      ['2026-07-12', '2026-07-13', '2026-07-14'].map(async (date) =>
        seedFoodLog({ loggedAt: await timestampFor('America/Toronto', date) }),
      ),
    );
    await seedFoodLog({
      loggedAt: await timestampFor('America/Toronto', '2026-07-05'),
    });

    const response = await api
      .get('/api/v1/analytics/reports')
      .query({ period: 'week', date: '2026-07-15' })
      .expect(200);

    expect(response.body.data.comparison.loggedDays).toBeDefined();
    expect(response.body.data.comparison.averageCalories).toBeUndefined();
    expect(response.body.data.comparison.calorieAdherence).toBeUndefined();
  });

  it('reveals weight facts at one, two, and three-log thresholds', async () => {
    await seedProfile();
    await seedGoals({ targetWeightLb: 190 });
    const userId = (await prisma.userProfile.findFirstOrThrow()).userId;
    const createWeight = async (date: string, weightLb: number) =>
      prisma.weightLog.create({
        data: {
          userId,
          weightLb,
          loggedAt: await timestampFor('America/Toronto', date),
        },
      });

    await createWeight('2026-07-13', 180);
    let response = await api
      .get('/api/v1/analytics/progress')
      .query({ date: '2026-07-15' })
      .expect(200);
    expect(response.body.data.weight.value).toMatchObject({
      latestWeightLb: 180,
      changeLb: null,
      trendRateLbPerWeek: null,
    });

    await createWeight('2026-07-14', 181);
    response = await api
      .get('/api/v1/analytics/progress')
      .query({ date: '2026-07-15' })
      .expect(200);
    expect(response.body.data.weight.value.changeLb).toBe(1);
    expect(response.body.data.weight.value.trendRateLbPerWeek).toBeNull();

    await createWeight('2026-07-15', 182);
    response = await api
      .get('/api/v1/analytics/progress')
      .query({ date: '2026-07-15' })
      .expect(200);
    expect(response.body.data.weight.value).toMatchObject({
      latestWeightLb: 182,
      direction: 'gaining',
      progressFromBaselineLb: 2,
      progressToTargetPercent: 20,
    });
    expect(response.body.data.weight.value.trendRateLbPerWeek).not.toBeNull();
  });
});
