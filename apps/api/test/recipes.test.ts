import { MOCK_USER_ID } from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

async function trustedFood(
  input: {
    name?: string;
    userId?: string | null;
    calories?: number;
    protein?: number;
    servingOptions?: Prisma.InputJsonValue;
    nutrients?: Array<{
      nutrientKey: 'potassium' | 'vitaminC';
      amount: number;
      unit: 'mg';
    }>;
  } = {},
) {
  const name = input.name ?? 'Recipe food';
  return prisma.foodItem.create({
    data: {
      userId: input.userId === undefined ? MOCK_USER_ID : input.userId,
      name,
      normalizedName: name.toLowerCase(),
      searchText: name.toLowerCase(),
      sourceType: 'cached_external',
      sourceProvider: 'usda_fdc',
      sourceId: `recipe-${name}`,
      foodType: 'generic',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      servingOptions: input.servingOptions ?? Prisma.JsonNull,
      calories: input.calories ?? 100,
      protein: input.protein ?? 10,
      carbs: 20,
      fat: 5,
      sodium: 40,
      nutrients: {
        create: input.nutrients ?? [
          { nutrientKey: 'potassium', amount: 100, unit: 'mg' },
        ],
      },
    },
  });
}

function ingredient(foodItemId: string, quantity = 100, unit = 'g') {
  return { foodItemId, serving: { quantity, unit } };
}

async function createRecipe(
  input: {
    ingredients?: Array<ReturnType<typeof ingredient>>;
    portionCount?: number;
    finalCookedWeightGrams?: number | null;
  } = {},
) {
  const food = await trustedFood();
  const response = await api
    .post('/api/v1/recipes')
    .send({
      name: 'Frozen chili',
      description: 'Test recipe',
      portionCount: input.portionCount ?? 2,
      ...(input.finalCookedWeightGrams === undefined
        ? {}
        : { finalCookedWeightGrams: input.finalCookedWeightGrams }),
      ingredients: input.ingredients ?? [ingredient(food.id)],
    })
    .expect(200);
  return {
    food,
    recipe: response.body.data as {
      id: string;
      ingredients: Array<{ id: string; snapshot: unknown }>;
    },
  };
}

describe('recipes API', () => {
  it('returns a serializable empty list when no recipes exist', async () => {
    const response = await api.get('/api/v1/recipes').expect(200);
    expect(response.body).toEqual({
      success: true,
      data: { recipes: [] },
    });
  });

  it('creates, lists, reads, updates metadata, and archives recipes', async () => {
    const { recipe } = await createRecipe({ finalCookedWeightGrams: 200 });
    expect(recipe).toMatchObject({
      name: 'Frozen chili',
      portionCount: 2,
      finalCookedWeightGrams: 200,
      gramLoggingAvailable: true,
      total: { materialized: { calories: 100, protein: 10 } },
      perPortion: { materialized: { calories: 50, protein: 5 } },
      perGram: { fullPrecision: { calories: '0.5', protein: '0.05' } },
    });

    const listed = await api.get('/api/v1/recipes').expect(200);
    expect(listed.body.data.recipes).toHaveLength(1);
    expect(
      (await api.get(`/api/v1/recipes/${recipe.id}`).expect(200)).body.data.id,
    ).toBe(recipe.id);

    await api
      .put(`/api/v1/recipes/${recipe.id}`)
      .send({
        name: 'Updated chili',
        description: null,
        portionCount: 4,
        finalCookedWeightGrams: null,
      })
      .expect(200);
    await api.delete(`/api/v1/recipes/${recipe.id}`).expect(200);
    expect(
      (await api.get('/api/v1/recipes').expect(200)).body.data.recipes,
    ).toEqual([]);
    for (const method of ['get', 'put', 'delete'] as const) {
      const request = api[method](`/api/v1/recipes/${recipe.id}`);
      if (method === 'put') request.send({ name: 'Nope', portionCount: 1 });
      const response = await request.expect(404);
      expectErrorEnvelope(response.body, 'NOT_FOUND');
    }
    const archivedIngredient = await api
      .post(`/api/v1/recipes/${recipe.id}/ingredients`)
      .send(ingredient((await trustedFood()).id))
      .expect(404);
    expectErrorEnvelope(archivedIngredient.body, 'NOT_FOUND');
  });

  it('hides other users recipes and refuses their private FoodItems', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const otherFood = await trustedFood({ userId: OTHER_USER_ID });
    const otherRecipe = await prisma.recipe.create({
      data: {
        userId: OTHER_USER_ID,
        name: 'Private',
        portionCount: 1,
        ingredients: { create: { position: 0, ingredientSnapshot: {} } },
      },
    });
    expect(
      (await api.get('/api/v1/recipes').expect(200)).body.data.recipes,
    ).toEqual([]);
    expectErrorEnvelope(
      (await api.get(`/api/v1/recipes/${otherRecipe.id}`).expect(404)).body,
      'NOT_FOUND',
    );
    expectErrorEnvelope(
      (
        await api
          .post('/api/v1/recipes')
          .send({
            name: 'No access',
            portionCount: 1,
            ingredients: [ingredient(otherFood.id)],
          })
          .expect(404)
      ).body,
      'NOT_FOUND',
    );
  });

  it('creates atomically when any ingredient is unavailable', async () => {
    const food = await trustedFood();
    const response = await api
      .post('/api/v1/recipes')
      .send({
        name: 'Atomic',
        portionCount: 1,
        ingredients: [
          ingredient(food.id),
          ingredient('00000000-0000-4000-8000-000000000999'),
        ],
      })
      .expect(404);
    expectErrorEnvelope(response.body, 'NOT_FOUND');
    expect(await prisma.recipe.count()).toBe(0);
  });

  it('uses authoritative serving errors and portion/cooked-weight totals', async () => {
    const food = await trustedFood();
    const invalid = await api
      .post('/api/v1/recipes')
      .send({
        name: 'Invalid',
        portionCount: 1,
        ingredients: [ingredient(food.id, 0)],
      })
      .expect(400);
    expectErrorEnvelope(invalid.body, 'INVALID_SERVING_REQUEST');
    const review = await api
      .post('/api/v1/recipes')
      .send({
        name: 'Review',
        portionCount: 1,
        ingredients: [ingredient(food.id, 1, 'cup')],
      })
      .expect(422);
    expectErrorEnvelope(review.body, 'SERVING_NEEDS_REVIEW');
    const created = await api
      .post('/api/v1/recipes')
      .send({
        name: 'Portions',
        portionCount: 4,
        finalCookedWeightGrams: 250,
        ingredients: [ingredient(food.id, 125)],
      })
      .expect(200);
    expect(created.body.data).toMatchObject({
      total: { materialized: { calories: 125 } },
      perPortion: { materialized: { calories: 31 } },
      perGram: { fullPrecision: { calories: '0.5' } },
    });
  });

  it('keeps snapshots and normalized nutrients frozen through food changes, archive, and deletion', async () => {
    const { food, recipe } = await createRecipe();
    const before = await api.get(`/api/v1/recipes/${recipe.id}`).expect(200);
    await prisma.foodItem.update({
      where: { id: food.id },
      data: { calories: 900, protein: 90, archivedAt: new Date() },
    });
    const afterSourceChange = await api
      .get(`/api/v1/recipes/${recipe.id}`)
      .expect(200);
    expect(afterSourceChange.body.data).toEqual(before.body.data);
    const metadata = await api
      .put(`/api/v1/recipes/${recipe.id}`)
      .send({ name: 'Renamed frozen chili' })
      .expect(200);
    expect(metadata.body.data.ingredients).toEqual(
      before.body.data.ingredients,
    );
    expect(metadata.body.data.total).toEqual(before.body.data.total);
    await prisma.foodItem.delete({ where: { id: food.id } });
    const afterDelete = await api
      .get(`/api/v1/recipes/${recipe.id}`)
      .expect(200);
    expect(afterDelete.body.data.ingredients[0].snapshot).toEqual(
      before.body.data.ingredients[0].snapshot,
    );
    expect(afterDelete.body.data.total).toEqual(before.body.data.total);
    expect(afterDelete.body.data.total.materialized.nutrients).toEqual({
      potassium: { amount: 100, unit: 'mg' },
    });
  });

  it('adds, replaces, edits, and deletes one ordered ingredient without changing retained snapshots', async () => {
    const { recipe } = await createRecipe();
    const second = await trustedFood({
      name: 'Second',
      calories: 200,
      protein: 20,
    });
    const original = (await api.get(`/api/v1/recipes/${recipe.id}`).expect(200))
      .body.data;
    const added = await api
      .post(`/api/v1/recipes/${recipe.id}/ingredients`)
      .send(ingredient(second.id, 50))
      .expect(200);
    expect(
      added.body.data.ingredients.map(
        (value: { position: number }) => value.position,
      ),
    ).toEqual([0, 1]);
    const addedIngredientId = added.body.data.ingredients[1].id as string;
    expect(added.body.data.ingredients[0].snapshot).toEqual(
      original.ingredients[0].snapshot,
    );
    const edited = await api
      .put(`/api/v1/recipes/${recipe.id}/ingredients/${addedIngredientId}`)
      .send(ingredient(second.id, 25))
      .expect(200);
    expect(edited.body.data.ingredients[0].snapshot).toEqual(
      original.ingredients[0].snapshot,
    );
    expect(
      edited.body.data.ingredients[1].snapshot.resolvedNutrition.calories,
    ).toBe('50');
    await api
      .delete(`/api/v1/recipes/${recipe.id}/ingredients/${addedIngredientId}`)
      .expect(200);
    const last = await api
      .delete(
        `/api/v1/recipes/${recipe.id}/ingredients/${original.ingredients[0].id}`,
      )
      .expect(409);
    expectErrorEnvelope(last.body, 'RECIPE_LAST_INGREDIENT');
  });
});
