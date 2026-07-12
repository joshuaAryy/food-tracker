import {
  Prisma,
  type FoodItem,
  type FoodItemNutrient,
  type Recipe as PrismaRecipe,
  type RecipeIngredient as PrismaRecipeIngredient,
} from '@prisma/client';
import {
  recipeIngredientSnapshotSchema,
  recipeSnapshotSchema,
  recipeSchema,
  type Recipe,
  type RecipeCreateInput,
  type RecipeIngredientInput,
  type RecipeIngredientSnapshot,
  type RecipeLogInput,
  type RecipeNutritionSnapshot,
  type RecipeUpdateInput,
} from '@food-tracker/shared';
import type { NutrientKey, NutrientUnit } from '@prisma/client';
import { AppError, notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import {
  AuthoritativeServingInvariantError,
  calculateAuthoritativeServing,
  type AuthoritativeServingCalculationFailure,
  type AuthoritativeServingCalculationInput,
} from '../foodLogs/serving-resolution.js';
import {
  aggregateRecipeIngredientSnapshots,
  createRecipeIngredientSnapshot,
  roundRecipeNutritionForFoodLog,
  scaleRecipeNutrition,
} from './calculation.js';

type RecipeRecord = PrismaRecipe & { ingredients: PrismaRecipeIngredient[] };
type VisibleFoodItem = FoodItem & { nutrients: FoodItemNutrient[] };
type RecipeTransaction = Prisma.TransactionClient;

const recipeInclude = {
  ingredients: {
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
  },
};

const foodLogInclude = {
  nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] },
};

function visibleFoodWhere(userId: string): Prisma.FoodItemWhereInput {
  return { archivedAt: null, OR: [{ userId }, { userId: null }] };
}

function servingFailureError(
  failure: AuthoritativeServingCalculationFailure,
): AppError {
  switch (failure.code) {
    case 'SERVING_CONFLICT':
      return new AppError(400, failure.code, 'Provide one serving request.');
    case 'INVALID_SERVING_REQUEST':
      return new AppError(
        400,
        failure.code,
        'The requested serving is invalid.',
        {
          reason: failure.reason,
        },
      );
    case 'SERVING_NEEDS_REVIEW':
      return new AppError(
        422,
        failure.code,
        'This serving needs review before it can be used in a recipe.',
        {
          status: 'needs_review',
          reason: failure.reason,
        },
      );
    case 'SERVING_RESOLUTION_INVALID':
      return new AppError(
        400,
        failure.code,
        'The serving could not be resolved.',
        {
          reason: failure.reason,
        },
      );
    case 'INVALID_SERVING_BASIS':
      return new AppError(
        422,
        failure.code,
        'This food item cannot be used for authoritative serving resolution.',
      );
  }
}

function foodItemServingInput(
  foodItem: VisibleFoodItem,
  ingredient: RecipeIngredientInput,
): AuthoritativeServingCalculationInput {
  if (foodItem.calories === null || foodItem.protein === null) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Food item needs calories and protein before it can be used in a recipe.',
      {
        issues: [
          {
            path: ['foodItemId'],
            message:
              'Food item needs calories and protein before it can be used in a recipe.',
          },
        ],
      },
    );
  }
  if (foodItem.servingQuantity === null || foodItem.servingUnit === null) {
    throw new AppError(
      422,
      'INVALID_SERVING_BASIS',
      'This food item cannot be used for authoritative serving resolution.',
    );
  }
  const servingWeightGrams = foodItem.servingWeightGrams?.toNumber() ?? null;
  return {
    basis: {
      quantity: foodItem.servingQuantity.toNumber(),
      unit: foodItem.servingUnit,
      displayText: `per ${foodItem.servingQuantity.toString()} ${foodItem.servingUnit}`,
      equivalentWeightGrams: servingWeightGrams,
      equivalentVolumeMl: null,
    },
    basisNutrition: {
      calories: foodItem.calories,
      protein: foodItem.protein.toNumber(),
      carbs: foodItem.carbs?.toNumber() ?? null,
      fat: foodItem.fat?.toNumber() ?? null,
      fiber: foodItem.fiber?.toNumber() ?? null,
      sugar: foodItem.sugar?.toNumber() ?? null,
      sodium: foodItem.sodium,
      nutrients: Object.fromEntries(
        foodItem.nutrients.map((nutrient) => [
          nutrient.nutrientKey,
          { amount: nutrient.amount.toNumber(), unit: nutrient.unit },
        ]),
      ),
    },
    servingOptions: foodItem.servingOptions,
    serving: {
      quantity: ingredient.serving.quantity,
      unit: ingredient.serving.unit,
      ...(ingredient.serving.servingOptionId === undefined
        ? {}
        : { servingOptionId: ingredient.serving.servingOptionId }),
    },
    provenance: {
      basisOrigin: 'food_item',
      foodItemId: foodItem.id,
      sourceType: foodItem.sourceType,
      sourceProvider: foodItem.sourceProvider,
      sourceId: foodItem.sourceId,
      trustLevel: 'trusted',
    },
  };
}

async function visibleFoodItem(
  client: Pick<RecipeTransaction, 'foodItem'>,
  foodItemId: string,
  userId: string,
): Promise<VisibleFoodItem> {
  const foodItem = await client.foodItem.findFirst({
    where: { id: foodItemId, ...visibleFoodWhere(userId) },
    include: { nutrients: { orderBy: { nutrientKey: 'asc' } } },
  });
  if (foodItem === null) throw notFoundError('Food item');
  return foodItem;
}

async function frozenIngredient(
  client: Pick<RecipeTransaction, 'foodItem'>,
  userId: string,
  input: RecipeIngredientInput,
) {
  const foodItem = await visibleFoodItem(client, input.foodItemId, userId);
  const calculationInput = foodItemServingInput(foodItem, input);
  try {
    const result = calculateAuthoritativeServing(calculationInput);
    if (!result.ok) throw servingFailureError(result);
    return {
      foodItemId: foodItem.id,
      ingredientSnapshot: createRecipeIngredientSnapshot({
        ...calculationInput,
        foodItem: { id: foodItem.id, name: foodItem.name },
      }),
    };
  } catch (error) {
    if (error instanceof AuthoritativeServingInvariantError) {
      console.error('Recipe ingredient snapshot invariant failed', {
        foodItemId: foodItem.id,
      });
      throw new AppError(
        500,
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred',
      );
    }
    throw error;
  }
}

function ingredientSnapshotOrError(
  ingredient: PrismaRecipeIngredient,
): RecipeIngredientSnapshot {
  const parsed = recipeIngredientSnapshotSchema.safeParse(
    ingredient.ingredientSnapshot,
  );
  if (parsed.success) return parsed.data;
  console.error('Stored Recipe ingredient snapshot failed validation', {
    recipeIngredientId: ingredient.id,
  });
  throw new AppError(
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred',
  );
}

export function serializeRecipe(recipe: RecipeRecord): Recipe {
  const ingredients = recipe.ingredients.map((ingredient) => ({
    id: ingredient.id,
    foodItemId: ingredient.foodItemId,
    position: ingredient.position,
    snapshot: ingredientSnapshotOrError(ingredient),
    createdAt: ingredient.createdAt.toISOString(),
    updatedAt: ingredient.updatedAt.toISOString(),
  }));
  const totals = aggregateRecipeIngredientSnapshots({
    ingredients: ingredients.map((ingredient) => ingredient.snapshot),
    portionCount: recipe.portionCount,
    finalCookedWeightGrams: recipe.finalCookedWeightGrams?.toNumber() ?? null,
  });
  return recipeSchema.parse({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    portionCount: recipe.portionCount,
    finalCookedWeightGrams: recipe.finalCookedWeightGrams?.toNumber() ?? null,
    gramLoggingAvailable: recipe.finalCookedWeightGrams !== null,
    ingredients,
    ...totals,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  });
}

async function activeRecipe(
  client: Pick<RecipeTransaction, 'recipe'>,
  recipeId: string,
  userId: string,
): Promise<RecipeRecord> {
  const recipe = await client.recipe.findFirst({
    where: { id: recipeId, userId, archivedAt: null },
    include: recipeInclude,
  });
  if (recipe === null) throw notFoundError('Recipe');
  return recipe;
}

function transaction<T>(
  operation: (client: RecipeTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(operation, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

export async function listRecipes(userId: string): Promise<Recipe[]> {
  const recipes = await prisma.recipe.findMany({
    where: { userId, archivedAt: null },
    include: recipeInclude,
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
  return recipes.map(serializeRecipe);
}

export async function getRecipe(
  recipeId: string,
  userId: string,
): Promise<Recipe> {
  return serializeRecipe(await activeRecipe(prisma, recipeId, userId));
}

export async function createRecipe(
  input: RecipeCreateInput,
  userId: string,
): Promise<Recipe> {
  return transaction(async (client) => {
    const ingredients = await Promise.all(
      input.ingredients.map((item) => frozenIngredient(client, userId, item)),
    );
    const recipe = await client.recipe.create({
      data: {
        userId,
        name: input.name,
        description: input.description ?? null,
        portionCount: input.portionCount,
        finalCookedWeightGrams: input.finalCookedWeightGrams ?? null,
        ingredients: {
          create: ingredients.map((item, position) => ({
            ...item,
            ingredientSnapshot:
              item.ingredientSnapshot as Prisma.InputJsonValue,
            position,
          })),
        },
      },
      include: recipeInclude,
    });
    return serializeRecipe(recipe);
  });
}

export async function updateRecipe(
  recipeId: string,
  input: RecipeUpdateInput,
  userId: string,
): Promise<Recipe> {
  return transaction(async (client) => {
    const recipe = await activeRecipe(client, recipeId, userId);
    const data: Prisma.RecipeUpdateInput = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.description === undefined
        ? {}
        : { description: input.description }),
      ...(input.portionCount === undefined
        ? {}
        : { portionCount: input.portionCount }),
      ...(input.finalCookedWeightGrams === undefined
        ? {}
        : { finalCookedWeightGrams: input.finalCookedWeightGrams }),
    };
    const updated = await client.recipe.update({
      where: { id: recipe.id },
      data,
      include: recipeInclude,
    });
    return serializeRecipe(updated);
  });
}

export async function archiveRecipe(
  recipeId: string,
  userId: string,
): Promise<void> {
  await transaction(async (client) => {
    const recipe = await activeRecipe(client, recipeId, userId);
    await client.recipe.update({
      where: { id: recipe.id },
      data: { archivedAt: new Date() },
    });
  });
}

export async function addRecipeIngredient(
  recipeId: string,
  input: RecipeIngredientInput,
  userId: string,
): Promise<Recipe> {
  return transaction(async (client) => {
    const recipe = await activeRecipe(client, recipeId, userId);
    const ingredient = await frozenIngredient(client, userId, input);
    const position =
      Math.max(-1, ...recipe.ingredients.map((item) => item.position)) + 1;
    const updated = await client.recipe.update({
      where: { id: recipe.id },
      data: {
        ingredients: {
          create: {
            ...ingredient,
            ingredientSnapshot:
              ingredient.ingredientSnapshot as Prisma.InputJsonValue,
            position,
          },
        },
      },
      include: recipeInclude,
    });
    return serializeRecipe(updated);
  });
}

export async function updateRecipeIngredient(
  recipeId: string,
  ingredientId: string,
  input: RecipeIngredientInput,
  userId: string,
): Promise<Recipe> {
  return transaction(async (client) => {
    const recipe = await activeRecipe(client, recipeId, userId);
    const existing = recipe.ingredients.find(
      (ingredient) => ingredient.id === ingredientId,
    );
    if (existing === undefined) throw notFoundError('Recipe ingredient');
    const replacement = await frozenIngredient(client, userId, input);
    const updated = await client.recipe.update({
      where: { id: recipe.id },
      data: {
        ingredients: {
          update: {
            where: { id: existing.id },
            data: {
              ...replacement,
              ingredientSnapshot:
                replacement.ingredientSnapshot as Prisma.InputJsonValue,
            },
          },
        },
      },
      include: recipeInclude,
    });
    return serializeRecipe(updated);
  });
}

export async function deleteRecipeIngredient(
  recipeId: string,
  ingredientId: string,
  userId: string,
): Promise<Recipe> {
  return transaction(async (client) => {
    const recipe = await activeRecipe(client, recipeId, userId);
    const existing = recipe.ingredients.find(
      (ingredient) => ingredient.id === ingredientId,
    );
    if (existing === undefined) throw notFoundError('Recipe ingredient');
    if (recipe.ingredients.length === 1) {
      throw new AppError(
        409,
        'RECIPE_LAST_INGREDIENT',
        'A recipe requires at least one ingredient.',
      );
    }
    const updated = await client.recipe.update({
      where: { id: recipe.id },
      data: { ingredients: { delete: { id: existing.id } } },
      include: recipeInclude,
    });
    return serializeRecipe(updated);
  });
}

function canonicalDecimal(value: Prisma.Decimal): string {
  return value.toString();
}

function recipeLogScale(recipe: RecipeRecord, input: RecipeLogInput): string {
  if (input.unit === 'portion') {
    return new Prisma.Decimal(input.amount).div(recipe.portionCount).toString();
  }
  if (recipe.finalCookedWeightGrams === null) {
    throw new AppError(
      422,
      'RECIPE_FINAL_WEIGHT_REQUIRED',
      'A final cooked weight is required for gram logging.',
    );
  }
  return new Prisma.Decimal(input.amount)
    .div(recipe.finalCookedWeightGrams)
    .toString();
}

function recipeLogSnapshot(
  recipe: RecipeRecord,
  input: RecipeLogInput,
  recipeTotals: RecipeNutritionSnapshot,
  loggedNutrition: RecipeNutritionSnapshot,
  scale: string,
) {
  const ingredients = recipe.ingredients.map(ingredientSnapshotOrError);
  return recipeSnapshotSchema.parse({
    schemaVersion: 2,
    calculationSchemaVersion: 1,
    recipe: {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      portionCount: recipe.portionCount,
      finalCookedWeightGrams:
        recipe.finalCookedWeightGrams === null
          ? null
          : canonicalDecimal(recipe.finalCookedWeightGrams),
    },
    ingredients,
    recipeTotals,
    loggedNutrition,
    ingredientContributions: recipe.ingredients.map((ingredient, index) => ({
      recipeIngredientId: ingredient.id,
      position: ingredient.position,
      nutrition: scaleRecipeNutrition(
        ingredients[index]!.resolvedNutrition,
        scale,
      ),
    })),
    loggedAmount: new Prisma.Decimal(input.amount).toString(),
    loggedUnit: input.unit,
  });
}

export async function logRecipe(
  recipeId: string,
  input: RecipeLogInput,
  userId: string,
) {
  return transaction(async (client) => {
    const recipe = await activeRecipe(client, recipeId, userId);
    const ingredients = recipe.ingredients.map(ingredientSnapshotOrError);
    const totals = aggregateRecipeIngredientSnapshots({
      ingredients,
      portionCount: recipe.portionCount,
      finalCookedWeightGrams: recipe.finalCookedWeightGrams?.toNumber() ?? null,
    });
    const scale = recipeLogScale(recipe, input);
    const fullPrecisionNutrition = scaleRecipeNutrition(
      totals.total.fullPrecision,
      scale,
    );
    const loggedNutrition = roundRecipeNutritionForFoodLog(
      fullPrecisionNutrition,
    );
    const snapshot = recipeLogSnapshot(
      recipe,
      input,
      totals.total.fullPrecision,
      loggedNutrition,
      scale,
    );
    return client.foodLog.create({
      data: {
        userId,
        recipeId: recipe.id,
        foodName: recipe.name,
        mealType: input.mealType,
        calories: Number(loggedNutrition.calories),
        protein: loggedNutrition.protein,
        carbs: loggedNutrition.carbs,
        fat: loggedNutrition.fat,
        fiber: loggedNutrition.fiber,
        sugar: loggedNutrition.sugar,
        sodium:
          loggedNutrition.sodium === null
            ? null
            : Number(loggedNutrition.sodium),
        notes: input.notes ?? null,
        servingQuantity: input.amount,
        servingUnit: input.unit,
        servingSnapshot: Prisma.JsonNull,
        recipeSnapshot: snapshot as Prisma.InputJsonValue,
        loggedAt: new Date(input.loggedAt),
        nutrients: {
          create: Object.entries(loggedNutrition.nutrients).map(
            ([nutrientKey, nutrient]) => ({
              nutrientKey: nutrientKey as NutrientKey,
              amount: nutrient.amount,
              unit: nutrient.unit as NutrientUnit,
            }),
          ),
        },
      },
      include: foodLogInclude,
    });
  });
}
