import { Router } from 'express';
import {
  DEFAULT_TIMEZONE,
  foodLogFromAiEstimateInputSchema,
  type FoodLogNutritionOverride,
  type FoodLogFromAiEstimateInput,
  foodLogsFromCandidatesInputSchema,
  foodLogFromFoodItemInputSchema,
  foodLogsFromFoodItemsInputSchema,
  foodLogInputSchema,
  foodLogsQuerySchema,
  idParamsSchema,
} from '@food-tracker/shared';
import { Prisma, type NutrientKey, type NutrientUnit } from '@prisma/client';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { localDateRange } from '../../lib/dates.js';
import { AppError, notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo, serializeFoodLog } from '../../lib/serializers.js';
import {
  findOrCreateUsdaFoodItem,
  usdaFdcConfig,
} from '../foodItems/usda-fdc.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validatedBody,
  validatedParams,
  validatedQuery,
} from '../../middleware/validate.js';

type FoodLogInput = z.infer<typeof foodLogInputSchema>;
type FoodLogFromFoodItemInput = z.infer<typeof foodLogFromFoodItemInputSchema>;
type FoodLogsFromFoodItemsInput = z.infer<
  typeof foodLogsFromFoodItemsInputSchema
>;
type FoodLogsFromCandidatesInput = z.infer<
  typeof foodLogsFromCandidatesInputSchema
>;
type FoodLogsQuery = z.infer<typeof foodLogsQuerySchema>;
type IdParams = z.infer<typeof idParamsSchema>;

export const foodLogsRouter = Router();

async function userTimezone(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone ?? DEFAULT_TIMEZONE;
}

function normalizedFoodLog(input: FoodLogInput) {
  const normalizeOptional = (
    value: number | null | undefined,
    places: number,
  ) => (value === undefined || value === null ? null : roundTo(value, places));

  return {
    foodName: input.foodName,
    mealType: input.mealType,
    calories: Math.round(input.calories),
    protein: roundTo(input.protein, 1),
    carbs: normalizeOptional(input.carbs, 1),
    fat: normalizeOptional(input.fat, 1),
    fiber: normalizeOptional(input.fiber, 1),
    sugar: normalizeOptional(input.sugar, 1),
    sodium:
      input.sodium === undefined || input.sodium === null
        ? null
        : Math.round(input.sodium),
    notes: input.notes ?? null,
    servingQuantity: normalizeOptional(input.servingQuantity, 2),
    servingUnit: input.servingUnit ?? null,
    loggedAt: new Date(input.loggedAt),
  };
}

function aiEstimateNotes(input: FoodLogFromAiEstimateInput): string {
  const status = input.edited ? 'adjusted' : 'reviewed';
  const prefix = `[AI-estimated nutrition: low trust, ${status}]`;
  const userNotes = input.notes?.trim();
  return userNotes === undefined || userNotes === ''
    ? prefix
    : `${prefix} ${userNotes}`;
}

function visibleFoodWhere(userId: string): Prisma.FoodItemWhereInput {
  return {
    archivedAt: null,
    OR: [{ userId }, { userId: null }],
  };
}

async function visibleFoodItem(id: string, userId: string) {
  return prisma.foodItem.findFirst({
    where: { id, ...visibleFoodWhere(userId) },
    include: { nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] } },
  });
}

async function verifiedFoodItemId(
  foodItemId: string | null | undefined,
  userId: string,
): Promise<string | null | undefined> {
  if (foodItemId === undefined || foodItemId === null) {
    return foodItemId;
  }

  const foodItem = await visibleFoodItem(foodItemId, userId);
  if (foodItem === null) {
    throw notFoundError('Food item');
  }

  return foodItem.id;
}

function nutrientRows(input: FoodLogInput['nutrients']) {
  return Object.entries(input ?? {}).map(([nutrientKey, nutrient]) => ({
    nutrientKey: nutrientKey as NutrientKey,
    amount: roundTo(nutrient.amount, 4),
    unit: nutrient.unit as NutrientUnit,
  }));
}

function hasNutrientInput(input: FoodLogInput): boolean {
  return Object.prototype.hasOwnProperty.call(input, 'nutrients');
}

function hasFoodItemInput(input: FoodLogInput): boolean {
  return Object.prototype.hasOwnProperty.call(input, 'foodItemId');
}

function scaledOptionalDecimal(
  value: { toNumber(): number } | null,
  multiplier: number,
  places: number,
): number | null {
  return value === null ? null : roundTo(value.toNumber() * multiplier, places);
}

function scaledOptionalInteger(
  value: number | null,
  multiplier: number,
): number | null {
  return value === null ? null : Math.round(value * multiplier);
}

type FoodLogCreateData = ReturnType<typeof logFromFoodItemData>;

function applyNutritionOverride(
  data: FoodLogCreateData,
  override: FoodLogNutritionOverride | undefined,
): FoodLogCreateData {
  if (override === undefined) return data;

  const next = { ...data };
  if (override.calories !== undefined && override.calories !== null) {
    next.calories = Math.round(override.calories);
  }
  if (override.protein !== undefined && override.protein !== null) {
    next.protein = roundTo(override.protein, 1);
  }
  if (override.carbs !== undefined) {
    next.carbs = override.carbs === null ? null : roundTo(override.carbs, 1);
  }
  if (override.fat !== undefined) {
    next.fat = override.fat === null ? null : roundTo(override.fat, 1);
  }
  if (override.fiber !== undefined) {
    next.fiber = override.fiber === null ? null : roundTo(override.fiber, 1);
  }
  if (override.sugar !== undefined) {
    next.sugar = override.sugar === null ? null : roundTo(override.sugar, 1);
  }
  if (override.sodium !== undefined) {
    next.sodium = override.sodium === null ? null : Math.round(override.sodium);
  }

  if (override.nutrients !== undefined) {
    if (override.nutrients === null) {
      next.nutrients = { create: [] };
      return next;
    }

    const nutrientRows = new Map(
      next.nutrients.create.map((nutrient) => [nutrient.nutrientKey, nutrient]),
    );

    for (const [nutrientKey, nutrient] of Object.entries(override.nutrients)) {
      nutrientRows.set(nutrientKey as NutrientKey, {
        nutrientKey: nutrientKey as NutrientKey,
        amount: roundTo(nutrient.amount, 4),
        unit: nutrient.unit as NutrientUnit,
      });
    }

    next.nutrients = { create: [...nutrientRows.values()] };
  }

  return next;
}

function logFromFoodItemData(
  foodItem: NonNullable<Awaited<ReturnType<typeof visibleFoodItem>>>,
  input: FoodLogFromFoodItemInput,
) {
  const servingMultiplier = input.servingMultiplier;

  if (foodItem.calories === null || foodItem.protein === null) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Food item needs calories and protein before it can be logged.',
      {
        issues: [
          {
            path: ['foodItemId'],
            message:
              'Food item needs calories and protein before it can be logged.',
          },
        ],
      },
    );
  }

  return {
    foodItemId: foodItem.id,
    foodName: foodItem.name,
    mealType: input.mealType,
    calories: Math.round(foodItem.calories * servingMultiplier),
    protein: roundTo(foodItem.protein.toNumber() * servingMultiplier, 1),
    carbs: scaledOptionalDecimal(foodItem.carbs, servingMultiplier, 1),
    fat: scaledOptionalDecimal(foodItem.fat, servingMultiplier, 1),
    fiber: scaledOptionalDecimal(foodItem.fiber, servingMultiplier, 1),
    sugar: scaledOptionalDecimal(foodItem.sugar, servingMultiplier, 1),
    sodium: scaledOptionalInteger(foodItem.sodium, servingMultiplier),
    notes: input.notes ?? null,
    servingQuantity:
      foodItem.servingQuantity === null
        ? roundTo(servingMultiplier, 2)
        : roundTo(foodItem.servingQuantity.toNumber() * servingMultiplier, 2),
    servingUnit: foodItem.servingUnit,
    loggedAt: new Date(input.loggedAt),
    nutrients: {
      create: foodItem.nutrients.map((nutrient) => ({
        nutrientKey: nutrient.nutrientKey,
        amount: roundTo(nutrient.amount.toNumber() * servingMultiplier, 4),
        unit: nutrient.unit,
      })),
    },
  };
}

const foodLogInclude = {
  nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] },
};

type FoodLogTransaction = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function visibleFoodItemInTransaction(
  tx: FoodLogTransaction,
  id: string,
  userId: string,
) {
  return tx.foodItem.findFirst({
    where: { id, ...visibleFoodWhere(userId) },
    include: { nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] } },
  });
}

foodLogsRouter.get(
  '/',
  validateQuery(foodLogsQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const query = validatedQuery<FoodLogsQuery>(response);
    const timezone = await userTimezone(userId);
    const range = localDateRange(timezone, query);
    const foodLogs = await prisma.foodLog.findMany({
      where: {
        userId,
        ...(query.mealType === undefined ? {} : { mealType: query.mealType }),
        ...(range.gte === undefined && range.lt === undefined
          ? {}
          : { loggedAt: range }),
      },
      orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }],
      ...(query.limit === undefined ? {} : { take: query.limit }),
      include: foodLogInclude,
    });

    sendSuccess(response, { foodLogs: foodLogs.map(serializeFoodLog) });
  },
);

foodLogsRouter.post(
  '/from-food-item',
  validateBody(foodLogFromFoodItemInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodLogFromFoodItemInput>(response);
    const foodItem = await visibleFoodItem(input.foodItemId, userId);

    if (foodItem === null) {
      throw notFoundError('Food item');
    }

    const foodLog = await prisma.foodLog.create({
      data: {
        userId,
        ...applyNutritionOverride(
          logFromFoodItemData(foodItem, input),
          input.nutritionOverride,
        ),
      },
      include: foodLogInclude,
    });

    sendSuccess(response, serializeFoodLog(foodLog));
  },
);

foodLogsRouter.post(
  '/from-food-items',
  validateBody(foodLogsFromFoodItemsInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodLogsFromFoodItemsInput>(response);

    const foodLogs = await prisma.$transaction(async (tx) => {
      const createdFoodLogs = [];

      for (const item of input.items) {
        const foodItem = await visibleFoodItemInTransaction(
          tx,
          item.foodItemId,
          userId,
        );

        if (foodItem === null) {
          throw notFoundError('Food item');
        }

        const foodLog = await tx.foodLog.create({
          data: {
            userId,
            ...applyNutritionOverride(
              logFromFoodItemData(foodItem, {
                foodItemId: item.foodItemId,
                mealType: input.mealType,
                loggedAt: input.loggedAt,
                servingMultiplier: item.servingMultiplier,
                notes: input.notes,
              }),
              item.nutritionOverride,
            ),
          },
          include: foodLogInclude,
        });

        createdFoodLogs.push(foodLog);
      }

      return createdFoodLogs;
    });

    sendSuccess(response, { foodLogs: foodLogs.map(serializeFoodLog) });
  },
);

foodLogsRouter.post(
  '/from-candidates',
  validateBody(foodLogsFromCandidatesInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodLogsFromCandidatesInput>(response);
    const usdaConfig = usdaFdcConfig();

    const foodLogs = await prisma.$transaction(async (tx) => {
      const createdFoodLogs = [];

      for (const item of input.items) {
        const foodItem =
          item.candidateType === 'food_item'
            ? await visibleFoodItemInTransaction(tx, item.foodItemId, userId)
            : await findOrCreateUsdaFoodItem({
                sourceId: item.sourceId,
                config: usdaConfig,
                transaction: tx,
              });

        if (foodItem === null) {
          throw notFoundError('Food item');
        }

        const foodLog = await tx.foodLog.create({
          data: {
            userId,
            ...applyNutritionOverride(
              logFromFoodItemData(foodItem, {
                foodItemId: foodItem.id,
                mealType: input.mealType,
                loggedAt: input.loggedAt,
                servingMultiplier: item.servingMultiplier,
                notes: input.notes,
              }),
              item.nutritionOverride,
            ),
          },
          include: foodLogInclude,
        });

        createdFoodLogs.push(foodLog);
      }

      return createdFoodLogs;
    });

    sendSuccess(response, { foodLogs: foodLogs.map(serializeFoodLog) });
  },
);

foodLogsRouter.post(
  '/from-ai-estimate',
  validateBody(foodLogFromAiEstimateInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodLogFromAiEstimateInput>(response);
    const foodLog = await prisma.foodLog.create({
      data: {
        userId,
        foodName: input.foodName.trim(),
        mealType: input.mealType,
        calories: Math.round(input.calories),
        protein: roundTo(input.protein, 1),
        carbs: roundTo(input.carbs, 1),
        fat: roundTo(input.fat, 1),
        fiber:
          input.fiber === undefined || input.fiber === null
            ? null
            : roundTo(input.fiber, 1),
        sugar:
          input.sugar === undefined || input.sugar === null
            ? null
            : roundTo(input.sugar, 1),
        sodium:
          input.sodium === undefined || input.sodium === null
            ? null
            : Math.round(input.sodium),
        notes: aiEstimateNotes(input),
        servingQuantity:
          input.servingQuantity === undefined || input.servingQuantity === null
            ? null
            : roundTo(input.servingQuantity, 2),
        servingUnit: input.servingUnit ?? null,
        loggedAt: new Date(input.loggedAt),
        nutrients: { create: [] },
      },
      include: foodLogInclude,
    });

    sendSuccess(response, serializeFoodLog(foodLog));
  },
);

foodLogsRouter.get(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const foodLog = await prisma.foodLog.findFirst({
      where: { id, userId },
      include: foodLogInclude,
    });

    if (foodLog === null) {
      throw notFoundError('Food log');
    }

    sendSuccess(response, serializeFoodLog(foodLog));
  },
);

foodLogsRouter.post(
  '/',
  validateBody(foodLogInputSchema),
  async (_request, response) => {
    const input = validatedBody<FoodLogInput>(response);
    const userId = currentUserId(response);
    const foodItemId = await verifiedFoodItemId(input.foodItemId, userId);
    const foodLog = await prisma.foodLog.create({
      data: {
        userId,
        ...(foodItemId === undefined ? {} : { foodItemId }),
        ...normalizedFoodLog(input),
        nutrients: { create: nutrientRows(input.nutrients) },
      },
      include: foodLogInclude,
    });

    sendSuccess(response, serializeFoodLog(foodLog));
  },
);

foodLogsRouter.put(
  '/:id',
  validateParams(idParamsSchema),
  validateBody(foodLogInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const existing = await prisma.foodLog.findFirst({ where: { id, userId } });

    if (existing === null) {
      throw notFoundError('Food log');
    }

    const input = validatedBody<FoodLogInput>(response);
    const foodItemId = hasFoodItemInput(input)
      ? await verifiedFoodItemId(input.foodItemId, userId)
      : undefined;
    const foodLog = await prisma.foodLog.update({
      where: { id },
      data: {
        ...normalizedFoodLog(input),
        ...(foodItemId === undefined ? {} : { foodItemId }),
        ...(hasNutrientInput(input)
          ? {
              nutrients: {
                deleteMany: {},
                create: nutrientRows(input.nutrients),
              },
            }
          : {}),
      },
      include: foodLogInclude,
    });
    sendSuccess(response, serializeFoodLog(foodLog));
  },
);

foodLogsRouter.delete(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const result = await prisma.foodLog.deleteMany({ where: { id, userId } });

    if (result.count === 0) {
      throw notFoundError('Food log');
    }

    sendSuccess(response, { id, deleted: true });
  },
);
