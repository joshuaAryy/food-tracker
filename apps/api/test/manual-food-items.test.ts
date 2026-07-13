import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const baseNutrition = {
  calories: 100,
  protein: 10,
  carbs: 20,
  fat: 5,
  nutrients: { potassium: { amount: 120, unit: 'mg' } },
};

describe('manual FoodItems API', () => {
  it('creates a searchable user-owned per-100-g manual food without saving it', async () => {
    const response = await api
      .post('/api/v1/food-items/manual')
      .send({
        name: 'Homemade rice',
        description: 'Cooked at home',
        basis: { mode: 'per_100g' },
        nutrition: baseNutrition,
      })
      .expect(200);
    expect(response.body.data).toMatchObject({
      name: 'Homemade rice',
      description: 'Cooked at home',
      sourceType: 'user_custom',
      sourceProvider: 'manual',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      calories: 100,
      protein: 10,
    });
    expect(response.body.data.isSaved).toBe(false);
    expect(await prisma.savedFoodItem.count()).toBe(0);
    expect(
      (
        await api
          .get('/api/v1/food-items')
          .query({ query: 'Homemade rice' })
          .expect(200)
      ).body.data.foodItems,
    ).toHaveLength(1);
  });

  it('supports per-serving count bases and explicit physical equivalences', async () => {
    const count = await api
      .post('/api/v1/food-items/manual')
      .send({
        name: 'Homemade egg',
        basis: { mode: 'per_serving', quantity: 1, unit: 'egg' },
        nutrition: { ...baseNutrition, calories: 70 },
      })
      .expect(200);
    expect(count.body.data.servingUnit).toBe('egg');
    const grams = await api
      .post('/api/v1/food-items/manual')
      .send({
        name: 'Soup ladle',
        basis: {
          mode: 'per_serving',
          quantity: 1,
          unit: 'serving',
          equivalentVolumeMl: 250,
        },
        nutrition: baseNutrition,
      })
      .expect(200);
    expect(grams.body.data.servingOptions.options).toContainEqual(
      expect.objectContaining({
        equivalentVolumeMl: 250,
        source: 'manual',
        trust: 'trusted',
      }),
    );
    const recipe = await api
      .post('/api/v1/recipes')
      .send({
        name: 'Soup recipe',
        portionCount: 1,
        ingredients: [
          {
            foodItemId: grams.body.data.id,
            serving: { quantity: 500, unit: 'ml' },
          },
        ],
      })
      .expect(200);
    expect(recipe.body.data.total.materialized.calories).toBe(200);
    const countRecipe = await api
      .post('/api/v1/recipes')
      .send({
        name: 'Count recipe',
        portionCount: 1,
        ingredients: [
          {
            foodItemId: count.body.data.id,
            serving: { quantity: 100, unit: 'g' },
          },
        ],
      })
      .expect(422);
    expectErrorEnvelope(countRecipe.body, 'SERVING_NEEDS_REVIEW');
    const chicken = await api
      .post('/api/v1/food-items/manual')
      .send({
        name: 'Chicken portion',
        basis: {
          mode: 'per_serving',
          quantity: 1,
          unit: 'serving',
          equivalentWeightGrams: 150,
        },
        nutrition: baseNutrition,
      })
      .expect(200);
    const fractional = await api
      .post('/api/v1/recipes')
      .send({
        name: 'Fractional chicken',
        portionCount: 1,
        ingredients: [
          {
            foodItemId: chicken.body.data.id,
            serving: { quantity: 75, unit: 'g' },
          },
        ],
      })
      .expect(200);
    expect(fractional.body.data.total.materialized.calories).toBe(50);
  });

  it('accepts explicit zero nutrition and preserves missing optional nutrients as unknown', async () => {
    const response = await api
      .post('/api/v1/food-items/manual')
      .send({
        name: 'Water',
        basis: { mode: 'per_100g' },
        nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      })
      .expect(200);
    expect(response.body.data).toMatchObject({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: {},
    });
  });

  it('updates only owned manual foods and archives them from search', async () => {
    const created = await api
      .post('/api/v1/food-items/manual')
      .send({
        name: 'Editable manual',
        basis: { mode: 'per_100g' },
        nutrition: baseNutrition,
      })
      .expect(200);
    const id = created.body.data.id as string;
    const updated = await api
      .put(`/api/v1/food-items/${id}/manual`)
      .send({ name: 'Renamed manual' })
      .expect(200);
    expect(updated.body.data.name).toBe('Renamed manual');
    await api.delete(`/api/v1/food-items/${id}`).expect(200);
    expect(
      (
        await api
          .get('/api/v1/food-items')
          .query({ query: 'Renamed manual' })
          .expect(200)
      ).body.data.foodItems,
    ).toEqual([]);
  });

  it('rejects invalid bases, unsupported conversions, and private ownership', async () => {
    for (const basis of [
      { mode: 'per_serving', quantity: 0, unit: 'serving' },
      { mode: 'per_serving', quantity: 1, unit: 'not-a-unit' },
    ]) {
      expectErrorEnvelope(
        (
          await api
            .post('/api/v1/food-items/manual')
            .send({ name: 'Invalid', basis, nutrition: baseNutrition })
            .expect(400)
        ).body,
        'VALIDATION_ERROR',
      );
    }
    const created = await api
      .post('/api/v1/food-items/manual')
      .send({
        name: 'Private check',
        basis: { mode: 'per_100g' },
        nutrition: baseNutrition,
      })
      .expect(200);
    await prisma.user.create({
      data: { id: '00000000-0000-4000-8000-000000000002' },
    });
    await prisma.foodItem.update({
      where: { id: created.body.data.id as string },
      data: { userId: '00000000-0000-4000-8000-000000000002' },
    });
    expectErrorEnvelope(
      (
        await api
          .put(`/api/v1/food-items/${created.body.data.id}/manual`)
          .send({ name: 'Nope' })
          .expect(404)
      ).body,
      'NOT_FOUND',
    );
  });

  it('keeps existing recipe snapshots frozen after a manual food edit', async () => {
    const created = await api
      .post('/api/v1/food-items/manual')
      .send({
        name: 'Frozen manual',
        basis: { mode: 'per_100g' },
        nutrition: baseNutrition,
      })
      .expect(200);
    const recipe = await api
      .post('/api/v1/recipes')
      .send({
        name: 'Frozen recipe',
        portionCount: 1,
        ingredients: [
          {
            foodItemId: created.body.data.id,
            serving: { quantity: 100, unit: 'g' },
          },
        ],
      })
      .expect(200);
    await api
      .put(`/api/v1/food-items/${created.body.data.id}/manual`)
      .send({ nutrition: { ...baseNutrition, calories: 900 } })
      .expect(200);
    const reread = await api
      .get(`/api/v1/recipes/${recipe.body.data.id}`)
      .expect(200);
    expect(reread.body.data.total.materialized.calories).toBe(100);
  });
});
