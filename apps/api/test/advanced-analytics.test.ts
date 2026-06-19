import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { localDateRange } from '../src/lib/dates.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { recentLocalDate, recentLocalDateTime } from './helpers/dates.js';
import { seedGoals, seedPreferences, seedProfile } from './helpers/seeds.js';

function timestampForTimezone(
  timezone: string,
  date: string,
  hourAfterMidnight: number,
): Date {
  const range = localDateRange(timezone, { date });

  if (range.gte === undefined) {
    throw new Error(`Could not create timestamp for ${date}`);
  }

  return new Date(range.gte.getTime() + hourAfterMidnight * 60 * 60 * 1000);
}

describe('advanced analytics API', () => {
  it('returns deterministic empty analytics without requiring complex mode', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });

    const response = await api
      .get('/api/v1/analytics/advanced')
      .query({ date: recentLocalDate(), rangeDays: 30 })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        date: recentLocalDate(),
        timezone: 'America/Toronto',
        rangeDays: 30,
        range: {
          startDate: recentLocalDate(29),
          endDate: recentLocalDate(),
        },
        trackingMode: 'simple',
        targets: { calories: null, proteinGrams: null },
        calorieTrend: {
          average7Day: 0,
          average30Day: 0,
          difference: 0,
        },
        proteinTrend: {
          average7Day: 0,
          average30Day: 0,
          difference: 0,
        },
        macros: {
          totals: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            sugar: 0,
            sodium: 0,
          },
          averagesPerLoggedDay: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            sugar: 0,
            sodium: 0,
          },
          calorieSplit: {
            proteinPercent: 0,
            carbsPercent: 0,
            fatPercent: 0,
          },
        },
        loggingConsistency: {
          past7Days: { loggedDays: 0, expectedDays: 7 },
          past30Days: { loggedDays: 0, expectedDays: 30 },
        },
        weightTrend: {
          latestWeightLb: null,
          latestLoggedAt: null,
          previousWeightLb: null,
          previousLoggedAt: null,
          changeLb: null,
          weeklySlopeLb: null,
        },
      },
    });
  });

  it('calculates exact 7-day and 30-day calorie and protein trends', async () => {
    await seedProfile();
    await seedGoals({
      targetCalories: 3000,
      targetProteinGrams: 150,
    });
    await prisma.foodLog.createMany({
      data: Array.from({ length: 30 }, (_, dayOffset) => {
        const recent = dayOffset < 7;
        return {
          userId: MOCK_USER_ID,
          foodName: `Day ${dayOffset + 1}`,
          mealType: 'dinner' as const,
          calories: recent ? 2000 : 1000,
          protein: recent ? 100 : 50,
          loggedAt: new Date(recentLocalDateTime(dayOffset)),
        };
      }),
    });

    const response = await api
      .get('/api/v1/analytics/advanced')
      .query({ date: recentLocalDate() })
      .expect(200);

    expect(response.body.data.targets).toEqual({
      calories: 3000,
      proteinGrams: 150,
    });
    expect(response.body.data.calorieTrend).toEqual({
      average7Day: 2000,
      average30Day: 1233.3,
      difference: 766.7,
    });
    expect(response.body.data.proteinTrend).toEqual({
      average7Day: 100,
      average30Day: 61.7,
      difference: 38.3,
    });
  });

  it('calculates macro totals and averages per logged day', async () => {
    await seedProfile();
    await prisma.foodLog.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          foodName: 'First',
          mealType: 'lunch',
          calories: 650,
          protein: 42.5,
          carbs: 50,
          fat: 20,
          fiber: 8,
          sugar: 10,
          sodium: 500,
          loggedAt: new Date(recentLocalDateTime(0)),
        },
        {
          userId: MOCK_USER_ID,
          foodName: 'Second',
          mealType: 'dinner',
          calories: 741,
          protein: 88.5,
          carbs: 70,
          fat: 30,
          fiber: 12,
          sugar: 20,
          sodium: 700,
          loggedAt: new Date(recentLocalDateTime(1)),
        },
      ],
    });

    const response = await api
      .get('/api/v1/analytics/advanced')
      .query({ date: recentLocalDate(), rangeDays: 3 })
      .expect(200);

    expect(response.body.data.macros.totals).toEqual({
      calories: 1391,
      protein: 131,
      carbs: 120,
      fat: 50,
      fiber: 20,
      sugar: 30,
      sodium: 1200,
    });
    expect(response.body.data.macros.averagesPerLoggedDay).toEqual({
      calories: 695.5,
      protein: 65.5,
      carbs: 60,
      fat: 25,
      fiber: 10,
      sugar: 15,
      sodium: 600,
    });
  });

  it('calculates macro calorie percentages using 4/4/9 math', async () => {
    await seedProfile();
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Macro meal',
        mealType: 'dinner',
        calories: 1000,
        protein: 131,
        carbs: 120,
        fat: 50,
        loggedAt: new Date(recentLocalDateTime()),
      },
    });

    const response = await api
      .get('/api/v1/analytics/advanced')
      .query({ date: recentLocalDate() })
      .expect(200);

    expect(response.body.data.macros.calorieSplit).toEqual({
      proteinPercent: 36,
      carbsPercent: 33,
      fatPercent: 30.9,
    });
  });

  it('counts distinct logged days across 7-day and 30-day windows', async () => {
    await seedProfile();
    const dayOffsets = [0, 1, 2, 10, 11, 12, 13, 14, 15, 16];
    await prisma.foodLog.createMany({
      data: dayOffsets.map((dayOffset) => ({
        userId: MOCK_USER_ID,
        foodName: `Day ${dayOffset}`,
        mealType: 'dinner' as const,
        calories: 500,
        protein: 30,
        loggedAt: new Date(recentLocalDateTime(dayOffset)),
      })),
    });

    const response = await api
      .get('/api/v1/analytics/advanced')
      .query({ date: recentLocalDate() })
      .expect(200);

    expect(response.body.data.loggingConsistency).toEqual({
      past7Days: { loggedDays: 3, expectedDays: 7 },
      past30Days: { loggedDays: 10, expectedDays: 30 },
    });
  });

  it('returns a partial weight trend when data is insufficient', async () => {
    await seedProfile();
    const loggedAt = new Date(recentLocalDateTime());
    await prisma.weightLog.create({
      data: {
        userId: MOCK_USER_ID,
        weightLb: 181.2,
        loggedAt,
      },
    });

    const response = await api
      .get('/api/v1/analytics/advanced')
      .query({ date: recentLocalDate() })
      .expect(200);

    expect(response.body.data.weightTrend).toEqual({
      latestWeightLb: 181.2,
      latestLoggedAt: loggedAt.toISOString(),
      previousWeightLb: null,
      previousLoggedAt: null,
      changeLb: null,
      weeklySlopeLb: null,
    });
  });

  it('calculates latest change and weekly weight slope with enough data', async () => {
    await seedProfile();
    const oldest = new Date(recentLocalDateTime(14));
    const previous = new Date(recentLocalDateTime(7));
    const latest = new Date(recentLocalDateTime(0));
    await prisma.weightLog.createMany({
      data: [
        { userId: MOCK_USER_ID, weightLb: 180, loggedAt: oldest },
        { userId: MOCK_USER_ID, weightLb: 181, loggedAt: previous },
        { userId: MOCK_USER_ID, weightLb: 182, loggedAt: latest },
      ],
    });

    const response = await api
      .get('/api/v1/analytics/advanced')
      .query({ date: recentLocalDate(), rangeDays: 30 })
      .expect(200);

    expect(response.body.data.weightTrend).toEqual({
      latestWeightLb: 182,
      latestLoggedAt: latest.toISOString(),
      previousWeightLb: 181,
      previousLoggedAt: previous.toISOString(),
      changeLb: 1,
      weeklySlopeLb: 1,
    });
  });

  it('uses the requested timezone for local-day boundaries', async () => {
    const timezone = 'America/Los_Angeles';
    const date = '2026-06-15';
    await seedProfile({ timezone: 'America/Toronto' });
    await prisma.foodLog.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          foodName: 'Previous LA day',
          mealType: 'snack',
          calories: 100,
          protein: 10,
          loggedAt: timestampForTimezone(timezone, '2026-06-14', 23.5),
        },
        {
          userId: MOCK_USER_ID,
          foodName: 'Requested LA day',
          mealType: 'breakfast',
          calories: 200,
          protein: 20,
          loggedAt: timestampForTimezone(timezone, date, 0.5),
        },
      ],
    });

    const response = await api
      .get('/api/v1/analytics/advanced')
      .query({ date, timezone, rangeDays: 1 })
      .expect(200);

    expect(response.body.data.timezone).toBe(timezone);
    expect(response.body.data.macros.totals.calories).toBe(200);
    expect(response.body.data.macros.totals.protein).toBe(20);
  });

  it.each([
    ['invalid date', { date: '2026-02-30' }],
    ['invalid timezone', { timezone: 'Invalid/Timezone' }],
    ['range below minimum', { rangeDays: 0 }],
    ['range above maximum', { rangeDays: 366 }],
    ['non-numeric range', { rangeDays: 'thirty' }],
  ])('returns a validation error for %s', async (_label, query) => {
    const response = await api
      .get('/api/v1/analytics/advanced')
      .query(query)
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });
});
