import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectSuccessEnvelope } from './helpers/api.js';

describe('food library API', () => {
  it('returns an empty saved library section', async () => {
    const response = await api
      .get('/api/v1/food-items/library?section=saved')
      .expect(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toMatchObject({
      section: 'saved',
      foodItems: [],
    });
  });

  it('sets an independently stored authoritative default serving', async () => {
    const food = await prisma.foodItem.create({
      data: {
        userId: null,
        name: 'Library rice',
        normalizedName: 'library rice',
        searchText: 'library rice',
        sourceType: 'cached_external',
        sourceProvider: 'usda_fdc',
        sourceId: 'library-rice',
        foodType: 'generic',
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: 100,
        calories: 130,
        protein: 2.7,
      },
    });
    const response = await api
      .put(`/api/v1/food-items/${food.id}/default-serving`)
      .send({ quantity: 250, unit: 'g' })
      .expect(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toMatchObject({
      foodItemId: food.id,
      defaultServing: { quantity: 250, unit: 'g' },
    });
    expect(
      await prisma.savedFoodItem.count({ where: { foodItemId: food.id } }),
    ).toBe(0);
  });

  it('copies a supported overridden FoodLog into one idempotent manual FoodItem', async () => {
    const source = await prisma.foodItem.create({
      data: {
        userId: null,
        name: 'Adjusted oats',
        normalizedName: 'adjusted oats',
        searchText: 'adjusted oats',
        sourceType: 'cached_external',
        sourceProvider: 'usda_fdc',
        sourceId: '999',
        foodType: 'generic',
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: 100,
        calories: 280,
        protein: 12,
        carbs: 44,
        fat: 5,
        nutrients: {
          create: [{ nutrientKey: 'potassium', amount: 230, unit: 'mg' }],
        },
      },
    });
    const logged = await api
      .post('/api/v1/food-logs/from-food-item')
      .send({
        foodItemId: source.id,
        mealType: 'breakfast',
        loggedAt: new Date().toISOString(),
        serving: { quantity: 100, unit: 'g' },
        nutritionOverride: {
          mode: 'simple',
          calories: 280,
          protein: 12,
          carbs: 44,
          fat: 5,
        },
      })
      .expect(200);
    const log = { id: logged.body.data.id };
    const first = await api
      .post(`/api/v1/food-logs/${log.id}/save-as-manual-food`)
      .send({ description: 'Frozen copy' });
    expect(first.status).toBe(200);
    const second = await api
      .post(`/api/v1/food-logs/${log.id}/save-as-manual-food`)
      .send({})
      .expect(200);
    expect(first.body.data.id).toBe(second.body.data.id);
    expect(first.body.data).toMatchObject({
      name: 'Adjusted oats',
      description: 'Frozen copy',
      sourceType: 'user_custom',
      sourceProvider: 'manual',
      nutrients: { potassium: { amount: 230, unit: 'mg' } },
    });
  });
});
