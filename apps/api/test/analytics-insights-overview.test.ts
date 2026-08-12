import {
  ANALYTICS_OVERVIEW_KEYS,
  canonicalInsightsResponseWithOverviewSchema,
  MOCK_USER_ID,
} from '@food-tracker/shared';
import type { AnalyticsOverviewKey } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api } from './helpers/api.js';
import {
  localDateTime,
  recentLocalDate,
  recentLocalDateTime,
} from './helpers/dates.js';
import { seedGoals, seedPreferences, seedProfile } from './helpers/seeds.js';
import {
  computeInsightsOverview,
  type InsightsOverviewDependencies,
} from '../src/modules/analytics/trends/overview.js';
import { createTrendRequestContext } from '../src/modules/analytics/trends/service.js';

async function seedCompleteDay(dayOffset: number, fiber = 10, sodium = 400) {
  const loggedAt = new Date(recentLocalDateTime(dayOffset));
  const logs = await prisma.foodLog.createMany({
    data: ['breakfast', 'lunch', 'dinner'].map((mealType) => ({
      userId: MOCK_USER_ID,
      foodName: `Overview ${dayOffset} ${mealType}`,
      mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
      calories: 700,
      protein: 30,
      carbs: 40,
      fat: 20,
      fiber,
      sodium,
      loggedAt,
    })),
  });
  expect(logs.count).toBe(3);
  return loggedAt;
}

describe('canonical Insights v2 overview facts', () => {
  it('uses the canonical daily-period statistic for macros and nutrient highlights', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await seedGoals({
      goalType: 'maintain',
      targetCalories: 2100,
      targetProteinGrams: 90,
      targetFiberGrams: 30,
      limitSodiumMg: 2300,
    });
    await seedCompleteDay(1, 10, 100);
    await seedCompleteDay(2, 20, 300);

    const response = await api
      .get('/api/v1/analytics/insights')
      .query({ period: 'week' })
      .expect(200);

    expect(response.body.data.overview.macros.data).toMatchObject({
      protein: { grams: 90 },
      status: 'recorded',
    });
    expect(
      response.body.data.overview.nutrientHighlights.data.highlights,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: 'fiber', value: 45 }),
        expect.objectContaining({ metric: 'sodium', value: 600 }),
      ]),
    );
  });

  it('returns all core sections and independent overview outcomes with authoritative period facts', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await seedGoals({
      goalType: 'maintain',
      targetCalories: 2100,
      targetProteinGrams: 90,
      targetCarbsGrams: 210,
      targetFatGrams: 70,
      targetFiberGrams: 30,
      limitSodiumMg: 2300,
    });
    await seedCompleteDay(2, 10, 400);
    await seedCompleteDay(1, 8, 500);
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Partial current meal',
        mealType: 'breakfast',
        calories: 100,
        protein: 5,
        carbs: 4,
        fat: 2,
        fiber: 0,
        sodium: 50,
        loggedAt: new Date(recentLocalDateTime()),
        nutrients: {
          create: { nutrientKey: 'vitaminC', amount: 12, unit: 'mg' },
        },
      },
    });
    await prisma.waterLog.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          amountMl: 500,
          loggedAt: new Date(localDateTime(recentLocalDate(), 1)),
        },
        {
          userId: MOCK_USER_ID,
          amountMl: 750,
          loggedAt: new Date(localDateTime(recentLocalDate(), 23)),
        },
      ],
    });
    await prisma.weightLog.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          weightLb: 180,
          loggedAt: new Date(recentLocalDateTime(30)),
        },
        {
          userId: MOCK_USER_ID,
          weightLb: 178.5,
          loggedAt: new Date(recentLocalDateTime(2)),
        },
      ],
    });

    const response = await api
      .get('/api/v1/analytics/insights')
      .query({ period: 'week' })
      .expect(200);

    expect(
      canonicalInsightsResponseWithOverviewSchema.safeParse(response.body.data)
        .success,
    ).toBe(true);
    expect(Object.keys(response.body.data.sections)).toEqual([
      'calories',
      'protein',
      'carbs',
      'fat',
      'macroComposition',
      'weight',
      'hydration',
      'loggingConsistency',
    ]);
    expect(Object.keys(response.body.data.overview)).toEqual([
      'periodSummary',
      'energy',
      'macros',
      'nutrientHighlights',
      'hydration',
      'weight',
      'loggingConsistency',
    ]);

    const periodSummary = response.body.data.overview.periodSummary;
    expect(periodSummary).toMatchObject({
      status: 'available',
      data: {
        todaySoFar: {
          date: recentLocalDate(),
          mealCount: 1,
          calories: { value: 100, state: 'recorded' },
          protein: { value: 5, state: 'recorded' },
        },
        eligibleLoggedDayCount: 3,
        eligibleTotalDayCount: 3,
      },
    });
    expect(response.body.data.overview.hydration).toMatchObject({
      status: 'available',
      data: { total: 1250, goal: 2000, status: 'below_goal' },
    });
    expect(response.body.data.overview.weight).toMatchObject({
      status: 'available',
      data: {
        current: 178.5,
        change: { periodDays: 30, value: -1.5, direction: 'down' },
      },
    });
    expect(
      response.body.data.overview.nutrientHighlights.data.highlights,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'fiber',
          value: 18,
          availability: 'recorded',
        }),
        expect.objectContaining({
          metric: 'sodium',
          value: expect.closeTo(916.6667, 3),
          reference: expect.objectContaining({ kind: 'limit' }),
        }),
        expect.objectContaining({
          metric: 'vitaminC',
          availability: 'partial',
          value: 12,
          status: 'unknown',
        }),
      ]),
    );
  });

  it('uses the tracking timezone for today hydration and excludes FoodLog water values', async () => {
    await seedProfile({ timezone: 'America/New_York' });
    await seedPreferences({ mode: 'simple' });
    await seedCompleteDay(0);
    await prisma.waterLog.create({
      data: {
        userId: MOCK_USER_ID,
        amountMl: 400,
        loggedAt: new Date(localDateTime(recentLocalDate(), 23)),
      },
    });
    await prisma.foodLog.updateMany({
      where: { userId: MOCK_USER_ID },
      data: { fiber: 0 },
    });

    const response = await api
      .get('/api/v1/analytics/insights')
      .query({ period: 'week' })
      .expect(200);

    expect(response.body.data.overview.hydration.data).toMatchObject({
      today: recentLocalDate(),
      total: 400,
    });
  });

  it('keeps a weight base outcome when its deterministic forecast is unavailable', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    await prisma.weightLog.create({
      data: {
        userId: MOCK_USER_ID,
        weightLb: 170,
        loggedAt: new Date(recentLocalDateTime()),
      },
    });

    const response = await api
      .get('/api/v1/analytics/insights')
      .query({ period: 'week' })
      .expect(200);

    expect(response.body.data.overview.weight).toMatchObject({
      status: 'available',
      data: {
        current: 170,
        forecast: { status: 'failed', code: 'section_unavailable' },
      },
    });
  });

  it('isolates each overview ownership group without deriving sibling facts', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await seedCompleteDay(1);

    for (const failingGroup of ANALYTICS_OVERVIEW_KEYS) {
      const context = createTrendRequestContext(MOCK_USER_ID, [
        'calories',
        'protein',
        'carbs',
        'fat',
        'macroComposition',
        'weight',
        'hydration',
        'loggingConsistency',
      ]);
      const dependencyKey = {
        periodSummary: 'computePeriodSummary',
        energy: 'computeEnergy',
        macros: 'computeMacros',
        nutrientHighlights: 'computeNutrientHighlights',
        hydration: 'computeHydration',
        weight: 'computeWeight',
        loggingConsistency: 'computeLoggingConsistency',
      }[failingGroup] as keyof InsightsOverviewDependencies;
      const dependencies: InsightsOverviewDependencies = {
        [dependencyKey]: async () => {
          throw new Error(`${failingGroup} overview failed`);
        },
      } as InsightsOverviewDependencies;
      const result = await computeInsightsOverview(
        MOCK_USER_ID,
        'week',
        context,
        dependencies,
      );

      expect(result[failingGroup]).toMatchObject({
        status: 'failed',
        code: 'section_unavailable',
      });
      for (const sibling of ANALYTICS_OVERVIEW_KEYS) {
        if (sibling === failingGroup) continue;
        expect(result[sibling].status).toBe('available');
      }
    }
  });

  it('does not expand the Simple catalog for overview-only nutrient highlights', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });

    const response = await api
      .get('/api/v1/analytics/trends/catalog')
      .expect(200);
    const keys = response.body.data.metrics.map(
      (metric: { key: AnalyticsOverviewKey | string }) => metric.key,
    );
    expect(keys).toEqual([
      'calories',
      'protein',
      'carbs',
      'fat',
      'macroComposition',
      'weight',
      'loggingConsistency',
      'hydration',
    ]);
    expect(keys).not.toEqual(
      expect.arrayContaining(['fiber', 'sodium', 'vitaminC']),
    );
  });
});
