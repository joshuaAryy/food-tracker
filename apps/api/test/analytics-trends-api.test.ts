import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { recentLocalDate, recentLocalDateTime } from './helpers/dates.js';
import { seedGoals, seedPreferences, seedProfile } from './helpers/seeds.js';

const caloriesQuery = {
  primaryMetric: 'calories',
  period: { kind: 'relative', days: 7 },
  aggregation: 'automatic',
  visualization: 'automatic',
  showReference: true,
  coverageFilter: 'all_logged_days',
};

describe('canonical analytics trends API', () => {
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
        loggedAt: new Date(recentLocalDateTime(6)),
      },
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'protein' })
      .expect(200);

    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          metricDataState: 'recorded',
          value: 31.5,
        }),
        expect.objectContaining({
          date: recentLocalDate(5),
          metricDataState: null,
          value: null,
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
        loggedAt: new Date(recentLocalDateTime(6)),
      },
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send({ ...caloriesQuery, primaryMetric: 'weight' })
      .expect(200);

    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          value: 174.2,
          metricDataState: 'recorded',
          loggingDayState: 'unlogged',
        }),
      ]),
    );
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
});
