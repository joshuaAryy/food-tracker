import { Router } from 'express';
import {
  DEFAULT_TIMEZONE,
  foodLogInputSchema,
  foodLogsQuerySchema,
  idParamsSchema,
} from '@food-tracker/shared';
import type { NutrientKey, NutrientUnit } from '@prisma/client';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { localDateRange } from '../../lib/dates.js';
import { notFoundError } from '../../lib/errors.js';
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
    const foodLog = await prisma.foodLog.create({
      data: {
        userId: currentUserId(response),
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
    const foodLog = await prisma.foodLog.update({
      where: { id },
      data: {
        ...normalizedFoodLog(input),
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
