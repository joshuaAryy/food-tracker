import { MOCK_USER_ID } from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';
const loggedAt = '2026-07-12T18:00:00.000Z';

async function trustedFood(
  input: { name?: string; userId?: string; calories?: number } = {},
) {
  const name = input.name ?? 'Recipe logging food';
  return prisma.foodItem.create({
    data: {
      userId: input.userId ?? MOCK_USER_ID,
      name,
      normalizedName: name.toLowerCase(),
      searchText: name.toLowerCase(),
      sourceType: 'cached_external',
      sourceProvider: 'usda_fdc',
      sourceId: `recipe-log-${name}`,
      foodType: 'generic',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      servingOptions: Prisma.JsonNull,
      calories: input.calories ?? 101,
      protein: 10.06,
      carbs: 5.55,
      fat: 2.22,
      sodium: 50,
      nutrients: {
        create: [
          { nutrientKey: 'potassium', amount: 120.12345, unit: 'mg' },
          { nutrientKey: 'vitaminC', amount: 12.34567, unit: 'mg' },
        ],
      },
    },
  });
}

async function createRecipe(
  input: { portionCount?: number; finalCookedWeightGrams?: number | null } = {},
) {
  const food = await trustedFood();
  const response = await api
    .post('/api/v1/recipes')
    .send({
      name: 'Batch oats',
      description: 'Frozen logging recipe',
      portionCount: input.portionCount ?? 4,
      ...(input.finalCookedWeightGrams === undefined
        ? {}
        : { finalCookedWeightGrams: input.finalCookedWeightGrams }),
      ingredients: [
        { foodItemId: food.id, serving: { quantity: 200, unit: 'g' } },
      ],
    })
    .expect(200);
  return { food, recipe: response.body.data as { id: string } };
}

function logRecipe(recipeId: string, amount: number, unit: 'portion' | 'g') {
  return api.post(`/api/v1/recipes/${recipeId}/log`).send({
    amount,
    unit,
    mealType: 'breakfast',
    loggedAt,
    notes: 'Recipe note',
  });
}

describe('recipe FoodLog materialization', () => {
  it('logs one recipe portion with one FoodLog, aggregated nutrient rows, and a complete frozen snapshot', async () => {
    const { recipe } = await createRecipe({ finalCookedWeightGrams: 800 });
    const response = await logRecipe(recipe.id, 1, 'portion').expect(200);

    expect(response.body.data).toMatchObject({
      recipeId: recipe.id,
      foodItemId: null,
      foodName: 'Batch oats',
      mealType: 'breakfast',
      calories: 51,
      protein: 5.1,
      carbs: 2.8,
      fat: 1.1,
      sodium: 25,
      servingQuantity: 1,
      servingUnit: 'portion',
      servingSnapshot: null,
      nutrients: {
        potassium: { amount: 60.0618, unit: 'mg' },
        vitaminC: { amount: 6.1729, unit: 'mg' },
      },
      recipeSnapshot: {
        schemaVersion: 2,
        calculationSchemaVersion: 1,
        recipe: {
          id: recipe.id,
          name: 'Batch oats',
          portionCount: 4,
          finalCookedWeightGrams: '800',
        },
        loggedAmount: '1',
        loggedUnit: 'portion',
        recipeTotals: { calories: '202', protein: '20.2' },
        loggedNutrition: { calories: '51', protein: '5.1' },
        ingredientContributions: [
          { position: 0, nutrition: { calories: '50.5', protein: '5.05' } },
        ],
      },
    });
    expect(await prisma.foodLog.count()).toBe(1);
    expect(await prisma.foodLogNutrient.count()).toBe(2);
  });

  it('logs fractional and multiple portions and grams using one full-precision scale then one persistence rounding pass', async () => {
    const { recipe } = await createRecipe({ finalCookedWeightGrams: 800 });
    const fractional = await logRecipe(recipe.id, 1.5, 'portion').expect(200);
    expect(fractional.body.data).toMatchObject({
      calories: 76,
      protein: 7.6,
      nutrients: { potassium: { amount: 90.0926 } },
      recipeSnapshot: {
        loggedNutrition: { calories: '76', protein: '7.6' },
        ingredientContributions: [
          { nutrition: { calories: '75.75', protein: '7.575' } },
        ],
      },
    });
    const grams = await logRecipe(recipe.id, 200, 'g').expect(200);
    expect(grams.body.data).toMatchObject({
      calories: 51,
      protein: 5.1,
      servingUnit: 'g',
      recipeSnapshot: {
        loggedAmount: '200',
        loggedUnit: 'g',
        loggedNutrition: { calories: '51', protein: '5.1' },
      },
    });
  });

  it('rejects gram logging without cooked weight and invalid amounts without writes', async () => {
    const { recipe } = await createRecipe({ finalCookedWeightGrams: null });
    const grams = await logRecipe(recipe.id, 100, 'g').expect(422);
    expectErrorEnvelope(grams.body, 'RECIPE_FINAL_WEIGHT_REQUIRED');
    const invalid = await logRecipe(recipe.id, 0, 'portion').expect(400);
    expectErrorEnvelope(invalid.body, 'VALIDATION_ERROR');
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('does not expose unowned or archived recipes to logging', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const otherRecipe = await prisma.recipe.create({
      data: {
        userId: OTHER_USER_ID,
        name: 'Private',
        portionCount: 1,
        ingredients: { create: { position: 0, ingredientSnapshot: {} } },
      },
    });
    expectErrorEnvelope(
      (await logRecipe(otherRecipe.id, 1, 'portion').expect(404)).body,
      'NOT_FOUND',
    );
    const { recipe } = await createRecipe();
    await api.delete(`/api/v1/recipes/${recipe.id}`).expect(200);
    expectErrorEnvelope(
      (await logRecipe(recipe.id, 1, 'portion').expect(404)).body,
      'NOT_FOUND',
    );
  });

  it('keeps historical recipe logs frozen through recipe and FoodItem changes, archival, and deletion', async () => {
    const { food, recipe } = await createRecipe({
      finalCookedWeightGrams: 800,
    });
    const created = await logRecipe(recipe.id, 1, 'portion').expect(200);
    const id = created.body.data.id as string;
    const before = await api.get(`/api/v1/food-logs/${id}`).expect(200);
    await api
      .put(`/api/v1/recipes/${recipe.id}`)
      .send({
        name: 'Edited batch',
        portionCount: 2,
        finalCookedWeightGrams: 400,
      })
      .expect(200);
    await prisma.foodItem.update({
      where: { id: food.id },
      data: { calories: 900, archivedAt: new Date() },
    });
    await api.delete(`/api/v1/recipes/${recipe.id}`).expect(200);
    await prisma.foodItem.delete({ where: { id: food.id } });
    const archived = await api.get(`/api/v1/food-logs/${id}`).expect(200);
    expect(archived.body.data).toEqual(before.body.data);
    await prisma.recipe.delete({ where: { id: recipe.id } });
    const deleted = await api.get(`/api/v1/food-logs/${id}`).expect(200);
    expect(deleted.body.data.recipeId).toBeNull();
    expect(deleted.body.data.recipeSnapshot).toEqual(
      before.body.data.recipeSnapshot,
    );
    expect(deleted.body.data.nutrients).toEqual(before.body.data.nutrients);
  });

  it('allows recipe-origin logs to update only metadata while ordinary FoodLogs retain their existing editing behavior', async () => {
    const { recipe } = await createRecipe();
    const recipeLog = await logRecipe(recipe.id, 1, 'portion').expect(200);
    const id = recipeLog.body.data.id as string;
    const metadata = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({
        mealType: 'dinner',
        notes: null,
        loggedAt: '2026-07-13T18:00:00.000Z',
      })
      .expect(200);
    expect(metadata.body.data).toMatchObject({
      mealType: 'dinner',
      notes: null,
      calories: 51,
      recipeId: recipe.id,
    });
    for (const input of [
      { foodName: 'Changed' },
      { calories: 99 },
      { nutrients: { potassium: { amount: 1, unit: 'mg' } } },
      { servingQuantity: 2 },
      { servingUnit: 'g' },
      { foodItemId: null },
      { servingSnapshot: null },
      { recipeId: null },
      { recipeSnapshot: null },
      { provenance: {} },
    ]) {
      const rejected = await api
        .put(`/api/v1/food-logs/${id}`)
        .send(input)
        .expect(409);
      expectErrorEnvelope(rejected.body, 'RECIPE_LOG_IMMUTABLE');
    }
    const ordinary = await api
      .post('/api/v1/food-logs')
      .send({
        foodName: 'Manual',
        mealType: 'lunch',
        calories: 100,
        protein: 10,
        loggedAt,
      })
      .expect(200);
    expect(
      (
        await api
          .put(`/api/v1/food-logs/${ordinary.body.data.id}`)
          .send({
            foodName: 'Manual',
            mealType: 'lunch',
            calories: 200,
            protein: 20,
            loggedAt,
          })
          .expect(200)
      ).body.data,
    ).toMatchObject({ calories: 200, protein: 20 });
  });

  it('rolls back recipe logging when a stored ingredient snapshot is malformed', async () => {
    const recipe = await prisma.recipe.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Malformed recipe',
        portionCount: 1,
        ingredients: { create: { position: 0, ingredientSnapshot: {} } },
      },
    });
    expectErrorEnvelope(
      (await logRecipe(recipe.id, 1, 'portion').expect(500)).body,
      'INTERNAL_SERVER_ERROR',
    );
    expect(await prisma.foodLog.count()).toBe(0);
    expect(await prisma.foodLogNutrient.count()).toBe(0);
  });
});
