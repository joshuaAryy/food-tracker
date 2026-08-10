import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api } from './helpers/api.js';
import { recentLocalDate, recentLocalDateTime } from './helpers/dates.js';
import { seedFoodLog, seedPreferences, seedProfile } from './helpers/seeds.js';

const hydrationQuery = {
  primaryMetric: 'hydration',
  period: { kind: 'relative', days: 7 },
  aggregation: 'automatic',
  visualization: 'automatic',
  showReference: true,
  coverageFilter: 'all_logged_days',
};

describe('hydration analytics', () => {
  it('uses only WaterLogs and the server-owned 2000 mL reference', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple', waterTrackingEnabled: false });
    const foodLog = await seedFoodLog({
      loggedAt: new Date(recentLocalDateTime(6)),
    });
    await prisma.foodLogNutrient.create({
      data: {
        foodLogId: foodLog.id,
        nutrientKey: 'water',
        amount: 900,
        unit: 'g',
      },
    });
    await prisma.waterLog.createMany({
      data: [750, 500].map((amountMl) => ({
        userId: MOCK_USER_ID,
        amountMl,
        loggedAt: new Date(recentLocalDateTime(6)),
      })),
    });

    const response = await api
      .post('/api/v1/analytics/trends/query')
      .send(hydrationQuery)
      .expect(200);

    expect(response.body.data).toMatchObject({
      primaryMetric: 'hydration',
      aggregation: 'daily',
      reference: {
        kind: 'target',
        value: 2000,
        unit: 'mL',
        source: 'default',
      },
    });
    expect(response.body.data.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: recentLocalDate(6),
          value: 1250,
        }),
        expect.objectContaining({ date: recentLocalDate(5), value: null }),
      ]),
    );
  });

  it('keeps fresh 7D and 30D hydration windows full length without pre-eligibility values', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'simple' });
    await prisma.waterLog.createMany({
      data: [
        { amountMl: 0, loggedAt: new Date(recentLocalDateTime(2)) },
        { amountMl: 500, loggedAt: new Date(recentLocalDateTime(1)) },
      ].map((log) => ({ ...log, userId: MOCK_USER_ID })),
    });

    for (const days of [7, 30]) {
      const response = await api
        .post('/api/v1/analytics/trends/query')
        .send({ ...hydrationQuery, period: { kind: 'relative', days } })
        .expect(200);

      expect(response.body.data).toMatchObject({
        resolvedRange: {
          startDate: recentLocalDate(days - 1),
          endDate: recentLocalDate(),
        },
        firstEligibleDate: recentLocalDate(2),
      });
      expect(response.body.data.points).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: recentLocalDate(days - 1),
            value: null,
            metricDataState: null,
          }),
          expect.objectContaining({
            date: recentLocalDate(2),
            value: 0,
            metricDataState: 'recorded',
          }),
        ]),
      );
    }
  });
});
