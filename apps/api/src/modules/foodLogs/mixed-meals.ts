import { Prisma, type NutrientKey, type NutrientUnit } from '@prisma/client';
import {
  mixedMealCreateInputSchema,
  mixedMealPreviewInputSchema,
  mixedMealSnapshotSchema,
  type MixedMealCreateInput,
  type MixedMealPreviewInput,
  type RecipeIngredientSnapshot,
} from '@food-tracker/shared';
import { AppError, notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { serializeFoodLog } from '../../lib/serializers.js';
import {
  aggregateRecipeIngredientSnapshots,
  createRecipeIngredientSnapshot,
  roundRecipeNutritionForFoodLog,
} from '../recipes/calculation.js';
import { foodItemServingInput } from '../recipes/service.js';
import {
  calculateAuthoritativeServing,
  type AuthoritativeServingCalculationFailure,
} from './serving-resolution.js';

type Tx = Prisma.TransactionClient;

const foodLogInclude = {
  nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] },
};
const recipeInclude = {
  ingredients: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
  },
};

function visibleFoodWhere(userId: string): Prisma.FoodItemWhereInput {
  return { archivedAt: null, OR: [{ userId }, { userId: null }] };
}

function servingError(
  result: AuthoritativeServingCalculationFailure,
): AppError {
  if (result.code === 'SERVING_NEEDS_REVIEW')
    return new AppError(
      422,
      result.code,
      'This serving needs review before it can be used.',
      { reason: result.reason },
    );
  if (result.code === 'INVALID_SERVING_REQUEST')
    return new AppError(400, result.code, 'The requested serving is invalid.', {
      reason: result.reason,
    });
  if (result.code === 'SERVING_RESOLUTION_INVALID')
    return new AppError(
      400,
      result.code,
      'The serving could not be resolved.',
      { reason: result.reason },
    );
  return new AppError(400, result.code, 'The serving request is invalid.', {
    reason: result.reason,
  });
}

async function frozenIngredients(
  client: Tx,
  userId: string,
  items: MixedMealPreviewInput['items'],
): Promise<Array<{ foodItemId: string; snapshot: RecipeIngredientSnapshot }>> {
  const result: Array<{
    foodItemId: string;
    snapshot: RecipeIngredientSnapshot;
  }> = [];
  for (const item of items) {
    const foodItem = await client.foodItem.findFirst({
      where: { id: item.foodItemId, ...visibleFoodWhere(userId) },
      include: { nutrients: { orderBy: { nutrientKey: 'asc' } } },
    });
    if (foodItem === null) throw notFoundError('Food item');
    const input = foodItemServingInput(foodItem, item);
    const serving = calculateAuthoritativeServing(input);
    if (!serving.ok) throw servingError(serving);
    result.push({
      foodItemId: foodItem.id,
      snapshot: createRecipeIngredientSnapshot({
        ...input,
        foodItem: { id: foodItem.id, name: foodItem.name },
      }),
    });
  }
  return result;
}

function calculation(
  name: string,
  description: string | null,
  snapshots: RecipeIngredientSnapshot[],
) {
  const totals = aggregateRecipeIngredientSnapshots({
    ingredients: snapshots,
    portionCount: 1,
    finalCookedWeightGrams: null,
  });
  const snapshot = mixedMealSnapshotSchema.parse({
    schemaVersion: 1,
    calculationSchemaVersion: 1,
    mixedMeal: { name, description },
    ingredients: snapshots,
    mealTotals: totals.total.fullPrecision,
    loggedNutrition: roundRecipeNutritionForFoodLog(totals.total.fullPrecision),
    ingredientContributions: snapshots.map((ingredient, position) => ({
      position,
      nutrition: ingredient.resolvedNutrition,
    })),
  });
  return { totals, snapshot };
}

export async function previewMixedMeal(
  input: MixedMealPreviewInput,
  userId: string,
) {
  mixedMealPreviewInputSchema.parse(input);
  const ingredients = await frozenIngredients(prisma, userId, input.items);
  const result = calculation(
    input.name,
    input.description ?? null,
    ingredients.map((item) => item.snapshot),
  );
  return {
    name: input.name,
    description: input.description ?? null,
    ingredients: ingredients.map((item) => item.snapshot),
    ...result.totals,
  };
}

export async function createMixedMeal(
  input: MixedMealCreateInput,
  userId: string,
) {
  mixedMealCreateInputSchema.parse(input);
  return prisma.$transaction(
    async (client) => {
      const ingredients = await frozenIngredients(client, userId, input.items);
      const calculated = calculation(
        input.name,
        input.description ?? null,
        ingredients.map((item) => item.snapshot),
      );
      const nutrition = calculated.snapshot.loggedNutrition;
      const saveAsRecipe =
        input.saveAsRecipe === true
          ? {
              name: input.name,
              description: input.description ?? null,
              portionCount: 1,
              finalCookedWeightGrams: null,
            }
          : input.saveAsRecipe === undefined
            ? undefined
            : {
                name: input.saveAsRecipe.name ?? input.name,
                description: input.saveAsRecipe.description ?? null,
                portionCount: input.saveAsRecipe.portionCount ?? 1,
                finalCookedWeightGrams:
                  input.saveAsRecipe.finalCookedWeightGrams ?? null,
              };
      const recipe =
        saveAsRecipe === undefined
          ? null
          : await client.recipe.create({
              data: {
                userId,
                name: saveAsRecipe.name,
                description: saveAsRecipe.description ?? null,
                portionCount: saveAsRecipe.portionCount,
                finalCookedWeightGrams:
                  saveAsRecipe.finalCookedWeightGrams ?? null,
                ingredients: {
                  create: ingredients.map((item, position) => ({
                    position,
                    foodItemId: item.foodItemId,
                    ingredientSnapshot: item.snapshot as Prisma.InputJsonValue,
                  })),
                },
              },
              include: recipeInclude,
            });
      const foodLog = await client.foodLog.create({
        data: {
          userId,
          recipeId: recipe?.id ?? null,
          foodName: input.name,
          mealType: input.mealType,
          calories: Number(nutrition.calories),
          protein: Number(nutrition.protein),
          carbs: nutrition.carbs === null ? null : Number(nutrition.carbs),
          fat: nutrition.fat === null ? null : Number(nutrition.fat),
          fiber: nutrition.fiber === null ? null : Number(nutrition.fiber),
          sugar: nutrition.sugar === null ? null : Number(nutrition.sugar),
          sodium: nutrition.sodium === null ? null : Number(nutrition.sodium),
          notes: input.notes ?? null,
          loggedAt: new Date(input.loggedAt),
          servingSnapshot: Prisma.JsonNull,
          recipeSnapshot: Prisma.JsonNull,
          mixedMealSnapshot: calculated.snapshot as Prisma.InputJsonValue,
          nutrients: {
            create: Object.entries(nutrition.nutrients).map(
              ([nutrientKey, nutrient]) => ({
                nutrientKey: nutrientKey as NutrientKey,
                amount: Number(nutrient.amount),
                unit: nutrient.unit as NutrientUnit,
              }),
            ),
          },
        },
        include: foodLogInclude,
      });
      return serializeFoodLog(foodLog);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
