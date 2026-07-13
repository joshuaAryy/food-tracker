import { MOCK_USER_ID } from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

async function food(name = 'Mixed rice', calories = 100) {
  return prisma.foodItem.create({
    data: {
      userId: MOCK_USER_ID,
      name,
      normalizedName: name.toLowerCase(),
      searchText: name.toLowerCase(),
      sourceType: 'cached_external',
      sourceProvider: 'usda_fdc',
      sourceId: `mixed-${name}`,
      foodType: 'generic',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      servingOptions: Prisma.JsonNull,
      calories,
      protein: 10,
      carbs: 20,
      fat: 5,
      nutrients: {
        create: [{ nutrientKey: 'potassium', amount: 100, unit: 'mg' }],
      },
    },
  });
}

const item = (foodItemId: string, quantity = 100) => ({
  foodItemId,
  serving: { quantity, unit: 'g' },
});

describe('mixed meal persistence', () => {
  it('previews without writes and aggregates frozen ingredients', async () => {
    const rice = await food();
    const response = await api
      .post('/api/v1/food-logs/mixed-meals/preview')
      .send({
        name: 'Rice bowl',
        items: [item(rice.id, 150)],
      })
      .expect(200);
    expect(await prisma.recipe.count()).toBe(0);
    expect(response.body.data).toMatchObject({
      name: 'Rice bowl',
      total: { materialized: { calories: 150, protein: 15 } },
    });
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('creates one FoodLog with a frozen snapshot and nutrient rows', async () => {
    const rice = await food();
    const response = await api
      .post('/api/v1/food-logs/mixed-meals')
      .send({
        name: 'Rice bowl',
        mealType: 'lunch',
        loggedAt: '2026-07-12T18:00:00.000Z',
        items: [item(rice.id, 150)],
      })
      .expect(200);
    expect(response.body.data).toMatchObject({
      foodName: 'Rice bowl',
      mixedMealSnapshot: {
        schemaVersion: 1,
        mixedMeal: { name: 'Rice bowl' },
        loggedNutrition: { calories: '150', protein: '15' },
      },
    });
    expect(await prisma.foodLog.count()).toBe(1);
    expect(await prisma.foodLogNutrient.count()).toBe(1);
  });

  it('supports atomic save-as-recipe and rejects immutable edits', async () => {
    const rice = await food();
    const response = await api
      .post('/api/v1/food-logs/mixed-meals')
      .send({
        name: 'Rice bowl',
        mealType: 'lunch',
        loggedAt: '2026-07-12T18:00:00.000Z',
        items: [item(rice.id)],
        saveAsRecipe: {},
      })
      .expect(200);
    expect(response.body.data.recipeId).not.toBeNull();
    const savedRecipe = await prisma.recipe.findUnique({
      where: { id: response.body.data.recipeId as string },
    });
    expect(savedRecipe).toMatchObject({ name: 'Rice bowl', portionCount: 1 });
    const logId = response.body.data.id as string;
    const immutable = await api
      .put(`/api/v1/food-logs/${logId}`)
      .send({ calories: 1 })
      .expect(409);
    expectErrorEnvelope(immutable.body, 'MIXED_MEAL_LOG_IMMUTABLE');
    expectErrorEnvelope(
      (
        await api
          .put(`/api/v1/food-logs/${logId}`)
          .send({ mixedMealSnapshot: {} })
          .expect(409)
      ).body,
      'MIXED_MEAL_LOG_IMMUTABLE',
    );
    await api
      .put(`/api/v1/food-logs/${logId}`)
      .send({ mealType: 'dinner', notes: 'updated' })
      .expect(200);
  });

  it('keeps preview and creation isolated from inaccessible ingredients', async () => {
    const rice = await food();
    const missing = '00000000-0000-4000-8000-000000000999';
    const preview = await api
      .post('/api/v1/food-logs/mixed-meals/preview')
      .send({
        name: 'Broken bowl',
        items: [item(rice.id), item(missing)],
      })
      .expect(404);
    expectErrorEnvelope(preview.body, 'NOT_FOUND');
    const created = await api
      .post('/api/v1/food-logs/mixed-meals')
      .send({
        name: 'Broken bowl',
        mealType: 'lunch',
        loggedAt: '2026-07-12T18:00:00.000Z',
        items: [item(rice.id), item(missing)],
        saveAsRecipe: true,
      })
      .expect(404);
    expectErrorEnvelope(created.body, 'NOT_FOUND');
    expect(await prisma.foodLog.count()).toBe(0);
    expect(await prisma.recipe.count()).toBe(0);
  });

  it('hides archived and private FoodItems from mixed-meal requests', async () => {
    const archived = await food('Archived mixed food');
    await prisma.foodItem.update({
      where: { id: archived.id },
      data: { archivedAt: new Date() },
    });
    expectErrorEnvelope(
      (
        await api
          .post('/api/v1/food-logs/mixed-meals/preview')
          .send({ name: 'Nope', items: [item(archived.id)] })
          .expect(404)
      ).body,
      'NOT_FOUND',
    );

    const otherUserId = '00000000-0000-4000-8000-000000000002';
    await prisma.user.create({ data: { id: otherUserId } });
    const privateFood = await food('Private mixed food');
    await prisma.foodItem.update({
      where: { id: privateFood.id },
      data: { userId: otherUserId },
    });
    expectErrorEnvelope(
      (
        await api
          .post('/api/v1/food-logs/mixed-meals')
          .send({
            name: 'Private bowl',
            mealType: 'lunch',
            loggedAt: '2026-07-12T18:00:00.000Z',
            items: [item(privateFood.id)],
          })
          .expect(404)
      ).body,
      'NOT_FOUND',
    );
  });
});
