import { Router } from 'express';
import {
  DEFAULT_TIMEZONE,
  foodLogFromFoodItemInputSchema,
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
  validateBody,
  validateParams,
  validateQuery,
  validatedBody,
  validatedParams,
  validatedQuery,
} from '../../middleware/validate.js';

type FoodLogInput = z.infer<typeof foodLogInputSchema>;
type FoodLogFromFoodItemInput = z.infer<typeof foodLogFromFoodItemInputSchema>;
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
        ...logFromFoodItemData(foodItem, input),
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
