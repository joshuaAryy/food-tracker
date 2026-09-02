import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { recentLocalDate, recentLocalDateTime } from './helpers/dates.js';
import {
  seedFoodItem,
  seedGoals,
  seedPreferences,
  seedProfile,
} from './helpers/seeds.js';

const caloriesQuery = {
  primaryMetric: 'calories',
  period: { kind: 'relative', days: 7 },
  aggregation: 'automatic',
  visualization: 'automatic',
  showReference: true,
  coverageFilter: 'all_logged_days',
};

describe('canonical analytics trends API', () => {
  it('loads the selected FoodLog range once for a two-metric comparison', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    const findMany = vi.spyOn(prisma.foodLog, 'findMany');

    try {
      await api
        .post('/api/v1/analytics/trends/query')
        .send({
          ...caloriesQuery,
          primaryMetric: 'protein',
          comparisonMetric: 'carbs',
        })
        .expect(200);

      expect(findMany).toHaveBeenCalledTimes(1);
    } finally {
      findMany.mockRestore();
    }
  });

  it('loads the bounded FoodLog range once for all canonical Insights sections', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    const findMany = vi.spyOn(prisma.foodLog, 'findMany');

    try {
      await api.get('/api/v1/analytics/insights?period=month').expect(200);

      // The overview adds one bounded previous-period read while the
      // canonical trend sections continue to share their selected range.
      expect(findMany).toHaveBeenCalledTimes(2);
    } finally {
      findMany.mockRestore();
    }
  });

  it('returns canonical calorie points with nullable gaps, not legacy zero fill', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await seedGoals({ goalType: 'gain', targetCalories: 2000 });
    await prisma.foodLog.createMany({
      data: [
        { mealType: 'breakfast' as const, calories: 200, protein: 20 },
        { mealType: 'lunch' as const, calories: 300, protein: 30 },
        { mealType: 'dinner' as const, calories: 500, protein: 50 },
      ].map((log) => ({
        userId: MOCK_USER_ID,
        foodName: 'Complete day meal',
        loggedAt: new Date(recentLocalDateTime(6)),
        ...log,
      })),
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send(caloriesQuery)
      .expect(200);

    expect(response.body.data).toMatchObject({
      timezone: 'America/Toronto',
      trackingMode: 'simple',
      primaryMetric: 'calories',
      aggregation: 'daily',
      resolvedRange: {
        startDate: recentLocalDate(6),
        endDate: recentLocalDate(),
      },
      reference: {
        kind: 'range',
        lower: 1900,
        upper: 2300,
        unit: 'kcal',
      },
    });
    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          loggingDayState: 'complete',
          loggingDayPhase: 'closed',
          metricDataState: 'recorded',
          value: 1000,
        }),
        expect.objectContaining({
          date: recentLocalDate(5),
          loggingDayState: 'unlogged',
          metricDataState: null,
          value: null,
        }),
      ]),
    );
    expect(response.body.data.points).not.toContainEqual(
      expect.objectContaining({
        loggingDayState: 'unlogged',
        value: 0,
      }),
    );
  });

  it('returns a typed unavailable calorie forecast instead of fabricating a sparse projection', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, includeForecast: true })
      .expect(200);
    expect(response.body.data.forecast).toEqual({
      kind: 'unavailable',
      reason: 'insufficient_coverage',
    });
  });

  it('returns a backend-owned rolling calorie series without smoothing across missing days', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await prisma.foodLog.createMany({
      data: [6, 5, 4].flatMap((daysAgo, index) =>
        ['breakfast', 'lunch', 'dinner'].map((mealType) => ({
          userId: MOCK_USER_ID,
          foodName: `Rolling calorie day ${daysAgo}`,
          mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
          calories: 100 + index * 100,
          protein: 20,
          loggedAt: new Date(recentLocalDateTime(daysAgo)),
        })),
      ),
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send(caloriesQuery)
      .expect(200);

    expect(response.body.data.rollingTrend).toMatchObject({ window: 3 });
    expect(response.body.data.rollingTrend.values).toEqual([
      300,
      450,
      600,
      null,
      null,
      null,
      null,
    ]);
  });

  it('enforces Simple metric access on the server and returns a mode-filtered catalog', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });

    const catalog = await api
      .get('/api/v1/analytics/trends/catalog')
      .expect(200);
    expect(
      catalog.body.data.metrics.map((metric: { key: string }) => metric.key),
    ).toEqual(
      expect.arrayContaining(['calories', 'hydration', 'loggingConsistency']),
    );
    expect(
      catalog.body.data.metrics.map((metric: { key: string }) => metric.key),
    ).not.toContain('vitaminC');

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'vitaminC' })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('returns true weekly buckets for the automatic 90-day view', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await prisma.foodLog.createMany({
      data: ['breakfast', 'lunch', 'dinner'].map((mealType) => ({
        userId: MOCK_USER_ID,
        foodName: 'First eligible day meal',
        mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
        calories: 300,
        protein: 30,
        loggedAt: new Date(recentLocalDateTime(89)),
      })),
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, period: { kind: 'relative', days: 90 } })
      .expect(200);

    expect(response.body.data.aggregation).toBe('weekly');
    expect(response.body.data.points[0]).toMatchObject({
      kind: 'aggregated',
      loggingCounts: expect.any(Object),
      metricCounts: expect.any(Object),
      numericDayCount: expect.any(Number),
    });
  });

  it('returns Protein from authoritative FoodLog snapshots without zero-filling gaps', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Protein snapshot',
        mealType: 'breakfast',
        calories: 200,
        protein: 31.5,
        loggedAt: new Date(recentLocalDateTime(2)),
      },
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'protein' })
      .expect(200);

    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(2),
          metricDataState: 'recorded',
          value: 31.5,
        }),
        expect.objectContaining({
          date: recentLocalDate(3),
          metricDataState: null,
          value: null,
        }),
      ]),
    );
  });

  it('preserves column-backed nutrient values, including recorded zero, without treating missing fields as numeric data', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    const loggedAt = new Date(recentLocalDateTime(6));
    await prisma.foodLog.createMany({
      data: [
        { mealType: 'breakfast' as const, fiber: 0, sugar: 4.5, sodium: 120 },
        { mealType: 'lunch' as const, fiber: 6.5, sugar: 0, sodium: 340 },
        { mealType: 'dinner' as const, fiber: null, sugar: 8, sodium: 90 },
      ].map((nutrition) => ({
        userId: MOCK_USER_ID,
        foodName: 'Column nutrient snapshot',
        calories: 200,
        protein: 20,
        loggedAt,
        ...nutrition,
      })),
    });

    const fiber = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'fiber' })
      .expect(200);
    expect(fiber.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          loggingDayState: 'complete',
          metricDataState: 'partial',
          metricRecordedLogCount: 2,
          metricUnknownLogCount: 1,
          value: 6.5,
        }),
      ]),
    );

    const sodium = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'sodium' })
      .expect(200);
    expect(sodium.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          metricDataState: 'recorded',
          value: 550,
        }),
      ]),
    );
  });

  it('returns WeightLogs independently from FoodLog completeness', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await prisma.weightLog.create({
      data: {
        userId: MOCK_USER_ID,
        weightLb: 174.2,
        loggedAt: new Date(recentLocalDateTime(2)),
      },
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'weight' })
      .expect(200);

    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(2),
          value: 174.2,
          metricDataState: 'recorded',
          loggingDayState: 'unlogged',
        }),
        expect.objectContaining({
          date: recentLocalDate(3),
          value: null,
          metricDataState: null,
          loggingDayState: 'unlogged',
        }),
      ]),
    );
    expect(response.body.data.weightFacts).toMatchObject({
      current: 174.2,
      change: null,
      direction: 'unknown',
      target: null,
      goalPath: 'no_goal',
      recordedDayCount: 1,
      eligibleDayCount: 7,
    });
  });

  it('returns an authoritative amino-acid profile for Leucine detail', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Amino acid snapshot one',
        mealType: 'breakfast',
        calories: 200,
        protein: 20,
        loggedAt: new Date(recentLocalDateTime(2)),
        nutrients: {
          create: [
            { nutrientKey: 'leucine', amount: 2.8, unit: 'g' },
            { nutrientKey: 'histidine', amount: 1.2, unit: 'g' },
          ],
        },
      },
    });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Amino acid snapshot two',
        mealType: 'lunch',
        calories: 200,
        protein: 20,
        loggedAt: new Date(recentLocalDateTime(1)),
        nutrients: {
          create: [{ nutrientKey: 'leucine', amount: 2.4, unit: 'g' }],
        },
      },
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'leucine' })
      .expect(200);

    expect(response.body.data.aminoAcidProfile).toMatchObject({
      recordedDayCount: 2,
      entries: expect.arrayContaining([
        expect.objectContaining({
          metric: 'leucine',
          average: 2.6,
          reference: {
            kind: 'none',
            reason: 'not_configured',
            unit: 'g',
          },
          percentage: null,
          status: 'unknown',
        }),
        expect.objectContaining({
          metric: 'histidine',
          average: 1.2,
          status: 'unknown',
        }),
      ]),
    });
  });

  it('sums amino-acid snapshots by tracking day before averaging the profile', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    for (const [foodName, amount] of [
      ['Amino breakfast', 2.8],
      ['Amino lunch', 1.2],
      ['Amino next day', 2.4],
    ] as const) {
      await prisma.foodLog.create({
        data: {
          userId: MOCK_USER_ID,
          foodName,
          mealType: 'breakfast',
          calories: 200,
          protein: 20,
          loggedAt: new Date(
            recentLocalDateTime(foodName === 'Amino next day' ? 1 : 2),
          ),
          nutrients: {
            create: [{ nutrientKey: 'leucine', amount, unit: 'g' }],
          },
        },
      });
    }

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'leucine' })
      .expect(200);

    expect(
      response.body.data.aminoAcidProfile.entries.find(
        (entry: { metric: string }) => entry.metric === 'leucine',
      ).average,
    ).toBe(3.2);
  });

  it('returns logging consistency from meal behavior, not nutrient availability', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await prisma.foodLog.createMany({
      data: [
        ...['breakfast', 'lunch', 'dinner'].map((mealType) => ({
          userId: MOCK_USER_ID,
          foodName: 'Complete meal coverage',
          mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
          calories: 200,
          protein: 20,
          loggedAt: new Date(recentLocalDateTime(6)),
        })),
        {
          userId: MOCK_USER_ID,
          foodName: 'Partial meal coverage',
          mealType: 'breakfast' as const,
          calories: 200,
          protein: 20,
          loggedAt: new Date(recentLocalDateTime(5)),
        },
      ],
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'loggingConsistency' })
      .expect(200);

    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          loggingDayState: 'complete',
          value: 100,
        }),
        expect.objectContaining({
          date: recentLocalDate(5),
          loggingDayState: 'partial',
          value: 50,
        }),
      ]),
    );
    expect(response.body.data.loggingSummary).toMatchObject({
      complete: 1,
      partial: 1,
      unlogged: 5,
      inProgress: 1,
      currentDayPhase: 'in_progress',
    });
  });

  it('returns allowlisted dual-axis comparison data with fixed full-period domains', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Protein snapshot',
        mealType: 'breakfast',
        calories: 200,
        protein: 31.5,
        loggedAt: new Date(recentLocalDateTime(6)),
      },
    });
    await prisma.weightLog.create({
      data: {
        userId: MOCK_USER_ID,
        weightLb: 174.2,
        loggedAt: new Date(recentLocalDateTime(6)),
      },
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({
        ...caloriesQuery,
        primaryMetric: 'protein',
        comparisonMetric: 'weight',
      })
      .expect(200);

    expect(response.body.data.comparison).toMatchObject({
      strategy: 'dual_axis',
      metric: 'weight',
      primaryAxisDomain: { minimum: 0, maximum: 31.5 },
      comparisonAxisDomain: { minimum: 0, maximum: 174.2 },
    });
    expect(response.body.data.comparison.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: recentLocalDate(6), value: 174.2 }),
      ]),
    );
  });

  it('keeps the approved Calories and Weight comparison reachable through the API', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Calories comparison snapshot',
        mealType: 'breakfast',
        calories: 1846,
        protein: 0,
        loggedAt: new Date(recentLocalDateTime(3)),
      },
    });
    await prisma.weightLog.create({
      data: {
        userId: MOCK_USER_ID,
        weightLb: 129.4,
        loggedAt: new Date(recentLocalDateTime(3)),
      },
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({
        ...caloriesQuery,
        primaryMetric: 'calories',
        comparisonMetric: 'weight',
      })
      .expect(200);

    expect(response.body.data.comparison).toMatchObject({
      strategy: 'dual_axis',
      metric: 'weight',
    });
    expect(response.body.data.comparison.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: recentLocalDate(3), value: 129.4 }),
      ]),
    );
  });

  it('uses one fixed combined raw domain for Protein and Carbohydrates', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Shared scale snapshot',
        mealType: 'breakfast',
        calories: 200,
        protein: 30,
        carbs: 60,
        loggedAt: new Date(recentLocalDateTime(6)),
      },
    });
    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({
        ...caloriesQuery,
        primaryMetric: 'protein',
        comparisonMetric: 'carbs',
      })
      .expect(200);
    expect(response.body.data.comparison).toMatchObject({
      strategy: 'shared_unit',
      sharedAxisDomain: { minimum: 0, maximum: 60 },
      primaryAxisDomain: { minimum: 0, maximum: 60 },
      comparisonAxisDomain: { minimum: 0, maximum: 60 },
    });
  });

  it('normalizes Sodium and Potassium independently while preserving raw values and gaps', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    await seedGoals({ targetCalories: 2000, limitSodiumMg: null });
    const foodItem = await seedFoodItem({
      userId: null,
      sourceType: 'app_owned',
      name: 'Canonical mineral snapshot',
    });
    const log = await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodItemId: foodItem.id,
        foodName: 'Mineral snapshot',
        mealType: 'breakfast',
        calories: 200,
        protein: 20,
        sodium: 0,
        loggedAt: new Date(recentLocalDateTime(6)),
      },
    });
    await prisma.foodLogNutrient.create({
      data: {
        foodLogId: log.id,
        nutrientKey: 'potassium',
        amount: 2350,
        unit: 'mg',
      },
    });
    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({
        ...caloriesQuery,
        primaryMetric: 'sodium',
        comparisonMetric: 'potassium',
      })
      .expect(200);
    expect(response.body.data.reference).toMatchObject({
      kind: 'limit',
      value: 2300,
    });
    expect(response.body.data.relatedMetrics).toEqual(['potassium']);
    expect(response.body.data.comparison.reference).toMatchObject({
      kind: 'minimum',
      value: 3400,
    });
    expect(response.body.data.comparison).toMatchObject({
      sharedAxisDomain: { minimum: 0, maximum: 0.6911764705882353 },
      primaryAxisDomain: { minimum: 0, maximum: 0.6911764705882353 },
      comparisonAxisDomain: { minimum: 0, maximum: 0.6911764705882353 },
    });
    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          value: 0,
          normalizedValue: 0,
        }),
      ]),
    );
    expect(response.body.data.comparison.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          value: 2350,
          normalizedValue: 0.6911764705882353,
        }),
        expect.objectContaining({ date: recentLocalDate(5), value: null }),
      ]),
    );
  });

  it('rejects normalized comparison when either authoritative reference is unavailable', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({
        ...caloriesQuery,
        primaryMetric: 'sodium',
        comparisonMetric: 'potassium',
      })
      .expect(400);
    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('returns macro composition facts without coercing missing carbs or fat to zero', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Protein only snapshot',
        mealType: 'breakfast',
        calories: 200,
        protein: 30,
        loggedAt: new Date(recentLocalDateTime(6)),
      },
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'macroComposition' })
      .expect(200);

    expect(response.body.data.macroComposition).toEqual({
      protein: 30,
      carbs: null,
      fat: null,
    });
    expect(response.body.data.macroPercentages).toEqual({
      protein: null,
      carbs: null,
      fat: null,
    });
  });

  it('returns a canonical Insights envelope without legacy daily zero-fill data', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });

    const response = await api
      .get('/api/v1/analytics/insights?period=week')
      .expect(200);

    expect(response.body.data.sections.calories.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          loggingDayState: 'unlogged',
          value: null,
        }),
      ]),
    );
    expect(response.body.data).not.toHaveProperty('dailyBreakdowns');
  });

  it('serves WEEK and MONTH Insights when hydration begins inside each rolling window', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Existing food log',
        mealType: 'breakfast',
        calories: 200,
        protein: 20,
        loggedAt: new Date(recentLocalDateTime(6)),
      },
    });
    await prisma.waterLog.create({
      data: {
        userId: MOCK_USER_ID,
        amountMl: 750,
        loggedAt: new Date(recentLocalDateTime(2)),
      },
    });

    for (const period of ['week', 'month'] as const) {
      const response = await api
        .get(`/api/v1/analytics/insights?period=${period}`)
        .expect(200);
      const hydration = response.body.data.sections.hydration;

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
      expect(hydration).toMatchObject({
        firstEligibleDate: recentLocalDate(2),
        resolvedRange: {
          startDate: recentLocalDate(period === 'week' ? 6 : 29),
          endDate: recentLocalDate(),
        },
      });
      expect(hydration.points).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: recentLocalDate(period === 'week' ? 6 : 29),
            value: null,
            metricDataState: null,
            loggingDayState: period === 'week' ? 'partial' : 'unlogged',
          }),
          expect.objectContaining({
            date: recentLocalDate(2),
            value: 750,
            metricDataState: 'recorded',
          }),
        ]),
      );
    }
  });

  it('keeps a complete logging day separate from partial Vitamin C snapshot coverage', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    const foodItem = await seedFoodItem({
      userId: null,
      sourceType: 'app_owned',
      name: 'Canonical vitamin snapshot',
    });
    const loggedAt = new Date(recentLocalDateTime(6));
    const [first, second, third] = await Promise.all(
      ['breakfast', 'lunch', 'dinner'].map((mealType) =>
        prisma.foodLog.create({
          data: {
            userId: MOCK_USER_ID,
            foodItemId: foodItem.id,
            foodName: `${mealType} snapshot`,
            mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
            calories: 200,
            protein: 20,
            loggedAt,
          },
        }),
      ),
    );
    await prisma.foodLogNutrient.create({
      data: {
        foodLogId: first!.id,
        nutrientKey: 'vitaminC',
        amount: 75,
        unit: 'mg',
      },
    });
    await prisma.foodLogNutrient.create({
      data: {
        foodLogId: second!.id,
        nutrientKey: 'vitaminC',
        amount: 0,
        unit: 'mg',
      },
    });
    void third;

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'vitaminC' })
      .expect(200);
    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          loggingDayState: 'complete',
          metricDataState: 'partial',
          value: 75,
        }),
      ]),
    );
  });
});
