import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { localDateTime } from './helpers/dates.js';
import { seedFoodLog, seedProfile } from './helpers/seeds.js';

const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';
const MISSING_FOOD_LOG_ID = '00000000-0000-4000-8000-000000000099';

const validFoodLog = {
  foodName: 'Chicken wrap',
  mealType: 'lunch',
  calories: 650,
  protein: 42.5,
  carbs: 55.2,
  fat: 18.4,
  loggedAt: '2026-06-15T17:00:00.000Z',
};

describe('food logs API', () => {
  it('creates and persists a valid food log', async () => {
    const response = await api
      .post('/api/v1/food-logs')
      .send(validFoodLog)
      .expect(200);
    const persisted = await prisma.foodLog.findUnique({
      where: { id: response.body.data.id as string },
    });

    expect(response.body).toMatchObject({
      success: true,
      data: {
        foodName: 'Chicken wrap',
        mealType: 'lunch',
        calories: 650,
        protein: 42.5,
      },
    });
    expect(persisted?.userId).toBe(MOCK_USER_ID);
    expect(persisted?.calories).toBe(650);
  });

  it('returns created food logs', async () => {
    const created = await api
      .post('/api/v1/food-logs')
      .send(validFoodLog)
      .expect(200);

    const response = await api.get('/api/v1/food-logs').expect(200);

    expect(response.body.data.foodLogs).toHaveLength(1);
    expect(response.body.data.foodLogs[0].id).toBe(created.body.data.id);
  });

  it('returns a current-user food log by id', async () => {
    const foodLog = await seedFoodLog({ foodName: 'Fetched meal' });

    const response = await api
      .get(`/api/v1/food-logs/${foodLog.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: foodLog.id,
        foodName: 'Fetched meal',
      },
    });
  });

  it('returns not found for a missing food log', async () => {
    const response = await api
      .get(`/api/v1/food-logs/${MISSING_FOOD_LOG_ID}`)
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });

  it('does not return another user’s food log by id', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const foodLog = await prisma.foodLog.create({
      data: {
        userId: OTHER_USER_ID,
        foodName: 'Private meal',
        mealType: 'dinner',
        calories: 500,
        protein: 35,
        loggedAt: new Date(validFoodLog.loggedAt),
      },
    });

    const response = await api
      .get(`/api/v1/food-logs/${foodLog.id}`)
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });

  it('updates a food log', async () => {
    const created = await api
      .post('/api/v1/food-logs')
      .send(validFoodLog)
      .expect(200);
    const updatedInput = {
      ...validFoodLog,
      foodName: 'Updated wrap',
      calories: 700,
      protein: 50,
    };

    const response = await api
      .put(`/api/v1/food-logs/${created.body.data.id as string}`)
      .send(updatedInput)
      .expect(200);

    expect(response.body.data).toMatchObject({
      foodName: 'Updated wrap',
      calories: 700,
      protein: 50,
    });
    expect(
      (
        await prisma.foodLog.findUnique({
          where: { id: created.body.data.id as string },
        })
      )?.calories,
    ).toBe(700);
  });

  it('deletes a food log', async () => {
    const foodLog = await seedFoodLog();

    const response = await api
      .delete(`/api/v1/food-logs/${foodLog.id}`)
      .expect(200);

    expect(response.body.data).toEqual({ id: foodLog.id, deleted: true });
    expect(
      await prisma.foodLog.findUnique({ where: { id: foodLog.id } }),
    ).toBeNull();
  });

  it.each([
    ['invalid meal type', { ...validFoodLog, mealType: 'brunch' }],
    ['negative calories', { ...validFoodLog, calories: -1 }],
    ['invalid datetime', { ...validFoodLog, loggedAt: 'yesterday' }],
  ])('rejects %s', async (_label, input) => {
    const response = await api
      .post('/api/v1/food-logs')
      .send(input)
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('filters food logs by local date', async () => {
    await seedProfile();
    await seedFoodLog({
      foodName: 'Local June 14',
      loggedAt: new Date(localDateTime('2026-06-14', 23.5)),
    });
    await seedFoodLog({
      foodName: 'Local June 15',
      loggedAt: new Date(localDateTime('2026-06-15', 0.5)),
    });

    const response = await api
      .get('/api/v1/food-logs')
      .query({ date: '2026-06-15' })
      .expect(200);

    expect(response.body.data.foodLogs).toHaveLength(1);
    expect(response.body.data.foodLogs[0].foodName).toBe('Local June 15');
  });

  it('filters food logs by meal type', async () => {
    await seedFoodLog({ foodName: 'Breakfast', mealType: 'breakfast' });
    await seedFoodLog({ foodName: 'Dinner', mealType: 'dinner' });

    const response = await api
      .get('/api/v1/food-logs')
      .query({ mealType: 'dinner' })
      .expect(200);

    expect(response.body.data.foodLogs).toHaveLength(1);
    expect(response.body.data.foodLogs[0].foodName).toBe('Dinner');
  });

  it('rejects conflicting date filters', async () => {
    const response = await api
      .get('/api/v1/food-logs')
      .query({ date: '2026-06-15', startDate: '2026-06-14' })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });
});
