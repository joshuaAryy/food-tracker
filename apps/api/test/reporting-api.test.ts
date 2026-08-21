import {
  reportsResponseSchema,
  streakCalendarResponseSchema,
} from '@food-tracker/shared';
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
  it('returns padded Sunday-Saturday calendar weeks and goal-specific day facts', async () => {
    await seedProfile();
    await seedGoals({
      goalType: 'maintain',
      targetCalories: 2000,
      targetProteinGrams: 100,
    });
    await seedPreferences();
    await Promise.all(
      [
        ['2026-07-17', 2200],
        ['2026-07-18', 2300],
        ['2026-07-19', 1700],
        ['2026-07-20', 2000],
      ].map(async ([date, calories]) =>
        seedFoodLog({
          loggedAt: await timestampFor('America/Toronto', date as string),
          calories: calories as number,
        }),
      ),
    );

    const response = await api
      .get('/api/v1/analytics/streak-calendar')
      .query({ month: '2026-07' })
      .expect(200);
    const parsed = streakCalendarResponseSchema.parse(response.body.data);

    expect(parsed.monthBoundary).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });
    expect(parsed.displayBoundary).toEqual({
      startDate: '2026-06-28',
      endDate: '2026-08-01',
    });
    expect(parsed.weeks).toHaveLength(5);
    expect(parsed.weeks.every((week) => week.days.length === 7)).toBe(true);
    const calendarDays = parsed.weeks.flatMap((week) => week.days);
    expect(calendarDays.find((day) => day.date === '2026-06-28')).toMatchObject(
      {
        monthRelation: 'previous',
        phase: 'past',
        streakState: 'missed',
      },
    );
    expect(calendarDays.find((day) => day.date === '2026-08-01')).toMatchObject(
      {
        monthRelation: 'next',
      },
    );
    expect(parsed.acceptedCalorieRange).toMatchObject({
      lowerCalories: 1800,
      upperCalories: 2200,
    });
    expect(calendarDays.find((day) => day.date === '2026-07-17')).toMatchObject(
      {
        logged: true,
        calories: 2200,
        calorieStatus: 'within_range',
        goldDay: true,
      },
    );
    expect(calendarDays.find((day) => day.date === '2026-07-18')).toMatchObject(
      { streakState: 'over_target', goldDay: false },
    );
  });

  it('adds target metadata and nutrient totals without changing existing report fields', async () => {
    await seedProfile();
    await seedGoals({
      goalType: 'maintain',
      targetCalories: 2000,
      targetProteinGrams: 100,
    });
    await seedPreferences();
    await Promise.all(
      ['2026-07-13', '2026-07-14', '2026-07-15'].map(async (date) =>
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

    expect(parsed.current).toMatchObject({
      calorieTarget: 2000,
      proteinTargetGrams: 100,
      acceptedCalorieRange: {
        lowerCalories: 1800,
        upperCalories: 2200,
      },
      averageCalorieStatus: 'within_range',
    });
    expect(parsed.current.nutrientDetails?.calories).toMatchObject({
      displayName: 'Calories',
      category: 'macro',
      total: 6000,
      averagePerLoggedDay: 2000,
      unit: 'kcal',
      recordedDayCount: 3,
    });
    expect(parsed.current.nutrientDetails?.protein).toMatchObject({
      total: 300,
      averagePerLoggedDay: 100,
      unit: 'g',
      recordedDayCount: 3,
    });
  });

  it('returns a finite period goal and percentage for every supported nutrient', async () => {
    await seedProfile();
    await seedGoals({
      goalType: 'maintain',
      targetCalories: 2000,
      targetProteinGrams: 100,
      targetCarbsGrams: 200,
      targetFatGrams: 80,
      targetFiberGrams: 25,
      limitSugarGrams: 50,
      limitSodiumMg: 1000,
    });
    await seedPreferences({ mode: 'complex' });

    for (const date of ['2026-07-13', '2026-07-14', '2026-07-15']) {
      const log = await seedFoodLog({
        loggedAt: await timestampFor('America/Toronto', date),
        calories: 2000,
        protein: 120,
      });
      await prisma.foodLog.update({
        where: { id: log.id },
        data: {
          carbs: 200,
          fat: 80,
          fiber: 25,
          sugar: 60,
          sodium: 1200,
        },
      });
    }

    const response = await api
      .get('/api/v1/analytics/reports')
      .query({ period: 'week', date: '2026-07-15' })
      .expect(200);
    const current = response.body.data.current as {
      eligibleDays: number;
      reportingGoals?: Record<string, unknown>;
      nutrientDetails?: Record<string, Record<string, unknown>>;
    };

    expect(current.eligibleDays).toBe(3);
    expect(current.reportingGoals).toMatchObject({
      calories: {
        value: 2000,
        unit: 'kcal',
        direction: 'target',
        source: 'user',
      },
      protein: {
        value: 100,
        unit: 'g',
        direction: 'minimum',
        source: 'user',
      },
      sugar: {
        value: 50,
        unit: 'g',
        direction: 'limit',
        source: 'user',
      },
      sodium: {
        value: 1000,
        unit: 'mg',
        direction: 'limit',
        source: 'user',
      },
    });

    for (const key of [
      'calories',
      'protein',
      'carbs',
      'fat',
      'fiber',
      'sugar',
      'sodium',
    ]) {
      expect(current.nutrientDetails?.[key]).toMatchObject({
        periodGoal: expect.any(Number),
        percentage: expect.any(Number),
      });
      expect(Number.isFinite(current.nutrientDetails?.[key]?.percentage)).toBe(
        true,
      );
    }
    expect(current.nutrientDetails?.protein).toMatchObject({
      periodGoal: 300,
      percentage: 120,
    });
    expect(current.nutrientDetails?.sugar).toMatchObject({
      periodGoal: 150,
      percentage: 120,
    });
    expect(current.nutrientDetails?.sodium).toMatchObject({
      periodGoal: 3000,
      percentage: 120,
    });
  });

  it('preserves recorded zero, nullable nutrient, partial-period, and previous-period facts', async () => {
    await seedProfile();
    await seedGoals({
      goalType: 'maintain',
      targetCalories: 2000,
      targetProteinGrams: 100,
    });
    await seedPreferences();

    const currentLog = await seedFoodLog({
      loggedAt: await timestampFor('America/Toronto', '2026-07-13'),
      calories: 2000,
      protein: 100,
    });
    await prisma.foodLog.update({
      where: { id: currentLog.id },
      data: {
        carbs: 0,
        fat: 25,
        fiber: 0,
        sugar: null,
        sodium: 0,
      },
    });

    const previousLog = await seedFoodLog({
      loggedAt: await timestampFor('America/Toronto', '2026-07-06'),
      calories: 1800,
      protein: 90,
    });
    await prisma.foodLog.update({
      where: { id: previousLog.id },
      data: { carbs: 100, fat: 40, fiber: 12, sugar: 8, sodium: 500 },
    });

    const response = await api
      .get('/api/v1/analytics/reports')
      .query({ period: 'week', date: '2026-07-15' })
      .expect(200);
    const parsed = reportsResponseSchema.parse(response.body.data);

    expect(parsed.current.nutrientDetails).toMatchObject({
      carbs: { total: 0, averagePerLoggedDay: 0, recordedDayCount: 1 },
      fiber: { total: 0, averagePerLoggedDay: 0, recordedDayCount: 1 },
      fat: { total: 25, averagePerLoggedDay: 25, recordedDayCount: 1 },
      sodium: { total: 0, averagePerLoggedDay: 0, recordedDayCount: 1 },
    });
    expect(parsed.current.nutrientDetails?.sugar).toBeUndefined();
    expect(parsed.previousCompleted.nutrientDetails).toMatchObject({
      carbs: { total: 100, averagePerLoggedDay: 100, recordedDayCount: 1 },
      sugar: { total: 8, averagePerLoggedDay: 8, recordedDayCount: 1 },
    });
    expect(parsed.current.loggedDays).toBe(1);
    expect(parsed.previousCompleted.loggedDays).toBe(1);
  });

  it('keeps logged-without-target days factual when goals are missing', async () => {
    await seedProfile();
    await seedFoodLog({
      loggedAt: await timestampFor('America/Toronto', '2026-07-15'),
      calories: 2000,
    });

    const response = await api
      .get('/api/v1/analytics/streak-calendar')
      .query({ month: '2026-07' })
      .expect(200);
    const parsed = streakCalendarResponseSchema.parse(response.body.data);
    const day = parsed.weeks
      .flatMap((week) => week.days)
      .find((entry) => entry.date === '2026-07-15');

    expect(parsed.activeCalorieTarget).toBeNull();
    expect(day).toMatchObject({
      logged: true,
      streakState: 'logged_without_target',
      calorieStatus: 'no_target',
      goldDay: false,
    });
  });

  it('recalculates calendar facts after create, update, backdate, and delete', async () => {
    await seedProfile();
    await seedGoals({ goalType: 'maintain', targetCalories: 2000 });
    await seedPreferences();
    const log = await seedFoodLog({
      loggedAt: await timestampFor('America/Toronto', '2026-07-18'),
      calories: 2000,
    });

    const readDay = async (date: string) => {
      const response = await api
        .get('/api/v1/analytics/streak-calendar')
        .query({ month: '2026-07' })
        .expect(200);
      return streakCalendarResponseSchema
        .parse(response.body.data)
        .weeks.flatMap((week) => week.days)
        .find((day) => day.date === date);
    };

    expect(await readDay('2026-07-18')).toMatchObject({
      streakState: 'gold',
      goldDay: true,
    });
    await prisma.foodLog.update({
      where: { id: log.id },
      data: { calories: 1000 },
    });
    expect(await readDay('2026-07-18')).toMatchObject({
      streakState: 'partial',
      goldDay: false,
    });
    await prisma.foodLog.update({
      where: { id: log.id },
      data: {
        loggedAt: await timestampFor('America/Toronto', '2026-07-10'),
      },
    });
    expect(await readDay('2026-07-10')).toMatchObject({
      streakState: 'partial',
      logged: true,
    });
    await prisma.foodLog.delete({ where: { id: log.id } });
    expect(await readDay('2026-07-10')).toMatchObject({
      streakState: 'missed',
      logged: false,
    });
  });

  it('rejects a month that is not YYYY-MM', async () => {
    const response = await api
      .get('/api/v1/analytics/streak-calendar')
      .query({ month: 'July 2026' })
      .expect(400);
    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

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
