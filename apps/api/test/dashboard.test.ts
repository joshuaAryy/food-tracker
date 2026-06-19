import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api } from './helpers/api.js';
import { localDateTime } from './helpers/dates.js';
import { seedGoals, seedPreferences, seedProfile } from './helpers/seeds.js';

describe('dashboard summary API', () => {
  it('calculates exact deterministic calorie and protein totals', async () => {
    await seedProfile();
    await seedGoals({
      targetCalories: 3000,
      targetProteinGrams: 150,
    });
    await seedPreferences({ mode: 'complex' });
    await prisma.foodLog.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          foodName: 'Chicken wrap',
          mealType: 'lunch',
          calories: 650,
          protein: 42.5,
          loggedAt: new Date(localDateTime('2026-06-15', 10)),
        },
        {
          userId: MOCK_USER_ID,
          foodName: 'Protein dinner',
          mealType: 'dinner',
          calories: 741,
          protein: 88.5,
          loggedAt: new Date(localDateTime('2026-06-15', 19)),
        },
      ],
    });
    await prisma.weightLog.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          weightLb: 182,
          loggedAt: new Date(localDateTime('2026-06-14')),
        },
        {
          userId: MOCK_USER_ID,
          weightLb: 181.4,
          loggedAt: new Date(localDateTime('2026-06-16')),
        },
      ],
    });

    const response = await api
      .get('/api/v1/dashboard/summary')
      .query({ date: '2026-06-15' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        date: '2026-06-15',
        caloriesConsumed: 1391,
        calorieTarget: 3000,
        caloriesRemaining: 1609,
        proteinConsumed: 131,
        proteinTarget: 150,
        proteinRemaining: 19,
        latestWeightLb: 181.4,
        trackingMode: 'complex',
      },
    });
  });

  it('uses the profile timezone for local-date boundaries', async () => {
    await seedProfile({ timezone: 'America/Toronto' });
    await seedGoals();
    await prisma.foodLog.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          foodName: 'Previous local day',
          mealType: 'snack',
          calories: 100,
          protein: 10,
          loggedAt: new Date(localDateTime('2026-06-14', 23.5)),
        },
        {
          userId: MOCK_USER_ID,
          foodName: 'Requested local day',
          mealType: 'breakfast',
          calories: 200,
          protein: 20,
          loggedAt: new Date(localDateTime('2026-06-15', 0.5)),
        },
      ],
    });

    const response = await api
      .get('/api/v1/dashboard/summary')
      .query({ date: '2026-06-15' })
      .expect(200);

    expect(response.body.data.caloriesConsumed).toBe(200);
    expect(response.body.data.proteinConsumed).toBe(20);
  });
});
