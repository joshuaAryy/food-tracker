import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api } from './helpers/api.js';
import { recentLocalDate, recentLocalDateTime } from './helpers/dates.js';
import { seedPreferences, seedProfile } from './helpers/seeds.js';

const query = {
  primaryMetric: 'vitaminC',
  period: { kind: 'relative', days: 7 },
  aggregation: 'automatic',
  visualization: 'automatic',
  showReference: true,
  coverageFilter: 'all_logged_days',
};

describe('analytics contributors', () => {
  it('returns top foods from immutable snapshots while excluding unknown nutrient values', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    const logs = await Promise.all(
      [
        ['Oranges', 60],
        ['Peppers', 40],
        ['Kiwi', 20],
        ['Berries', 10],
        ['Unknown source', null],
        ['Recorded zero', 0],
      ].map(async ([foodName, vitaminC]) => {
        const log = await prisma.foodLog.create({
          data: {
            userId: MOCK_USER_ID,
            foodName: foodName as string,
            mealType: 'breakfast',
            calories: 100,
            protein: 10,
            loggedAt: new Date(recentLocalDateTime(6)),
          },
        });
        if (vitaminC !== null) {
          await prisma.foodLogNutrient.create({
            data: {
              foodLogId: log.id,
              nutrientKey: 'vitaminC',
              amount: vitaminC as number,
              unit: 'mg',
            },
          });
        }
        return log;
      }),
    );
    void logs;

    const response = await api
      .post('/api/v1/analytics/trends/contributors')
      .send(query)
      .expect(200);

    expect(response.body.data).toMatchObject({
      metric: 'vitaminC',
      recordedTotal: 130,
      hasMore: true,
      contributors: [
        { foodName: 'Oranges', value: 60, percentage: 60 / 130 },
        { foodName: 'Peppers', value: 40, percentage: 40 / 130 },
        { foodName: 'Kiwi', value: 20, percentage: 20 / 130 },
      ],
    });
    expect(response.body.data.contributors).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ foodName: 'Unknown source' }),
      ]),
    );
    expect(response.body.data.remainder).toMatchObject({
      value: 10,
      percentage: 10 / 130,
    });
    expect(response.body.data.resolvedRange).toEqual({
      startDate: recentLocalDate(6),
      endDate: recentLocalDate(),
    });
  });
});
