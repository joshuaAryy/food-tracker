import { Router } from 'express';
import {
  foodBarcodeParamsSchema,
  foodBarcodeQuerySchema,
  foodItemInputSchema,
  foodItemsQuerySchema,
  idParamsSchema,
} from '@food-tracker/shared';
import { Prisma, type NutrientKey, type NutrientUnit } from '@prisma/client';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import { roundTo, serializeFoodItem } from '../../lib/serializers.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validatedBody,
  validatedParams,
  validatedQuery,
} from '../../middleware/validate.js';

type FoodItemInput = z.infer<typeof foodItemInputSchema>;
type FoodItemsQuery = z.infer<typeof foodItemsQuerySchema>;
type FoodBarcodeParams = z.infer<typeof foodBarcodeParamsSchema>;
type FoodBarcodeQuery = z.infer<typeof foodBarcodeQuerySchema>;
type IdParams = z.infer<typeof idParamsSchema>;

export const foodItemsRouter = Router();

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function searchText(input: Pick<FoodItemInput, 'name' | 'brandName'>): {
  normalizedName: string;
  normalizedBrandName: string | null;
  searchText: string;
} {
  const normalizedName = normalizeText(input.name);
  const normalizedBrandName =
    input.brandName === undefined || input.brandName === null
      ? null
      : normalizeText(input.brandName);

  return {
    normalizedName,
    normalizedBrandName,
    searchText:
      normalizedBrandName === null
        ? normalizedName
        : `${normalizedName} ${normalizedBrandName}`,
  };
}

function normalizeOptionalDecimal(
  value: number | null | undefined,
  places: number,
): number | null {
  return value === undefined || value === null ? null : roundTo(value, places);
}

function normalizedFoodItem(input: FoodItemInput) {
  return {
    name: input.name.trim(),
    brandName: input.brandName?.trim() ?? null,
    foodType: input.foodType,
    ...searchText(input),
    servingQuantity: normalizeOptionalDecimal(input.servingQuantity, 2),
    servingUnit: input.servingUnit?.trim() ?? null,
    servingWeightGrams: normalizeOptionalDecimal(input.servingWeightGrams, 2),
    calories:
      input.calories === undefined || input.calories === null
        ? null
        : Math.round(input.calories),
    protein: normalizeOptionalDecimal(input.protein, 1),
    carbs: normalizeOptionalDecimal(input.carbs, 1),
    fat: normalizeOptionalDecimal(input.fat, 1),
    fiber: normalizeOptionalDecimal(input.fiber, 1),
    sugar: normalizeOptionalDecimal(input.sugar, 1),
    sodium:
      input.sodium === undefined || input.sodium === null
        ? null
        : Math.round(input.sodium),
    additionalNutrients:
      input.additionalNutrients === undefined ||
      input.additionalNutrients === null
        ? Prisma.JsonNull
        : (input.additionalNutrients as Prisma.InputJsonValue),
  };
}

function nutrientRows(input: FoodItemInput['nutrients']) {
  return Object.entries(input ?? {}).map(([nutrientKey, nutrient]) => ({
    nutrientKey: nutrientKey as NutrientKey,
    amount: roundTo(nutrient.amount, 4),
    unit: nutrient.unit as NutrientUnit,
  }));
}

function hasNutrientInput(input: FoodItemInput): boolean {
  return Object.prototype.hasOwnProperty.call(input, 'nutrients');
}

function visibleFoodWhere(userId: string): Prisma.FoodItemWhereInput {
  return {
    archivedAt: null,
    OR: [{ userId }, { userId: null }],
  };
}

function foodItemInclude(userId: string) {
  return {
    barcodes: { orderBy: [{ regionCode: 'asc' as const }] },
    nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] },
    savedByUsers: {
      where: { userId },
      select: { id: true },
    },
  };
}

async function visibleFoodItem(id: string, userId: string) {
  return prisma.foodItem.findFirst({
    where: { id, ...visibleFoodWhere(userId) },
    include: foodItemInclude(userId),
  });
}

async function editableCustomFoodItem(id: string, userId: string) {
  return prisma.foodItem.findFirst({
    where: {
      id,
      userId,
      sourceType: 'user_custom',
      archivedAt: null,
    },
  });
}

foodItemsRouter.get(
  '/',
  validateQuery(foodItemsQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const query = validatedQuery<FoodItemsQuery>(response);
    const normalizedQuery =
      query.query === undefined ? undefined : normalizeText(query.query);

    const foodItems = await prisma.foodItem.findMany({
      where: {
        ...visibleFoodWhere(userId),
        ...(normalizedQuery === undefined
          ? {}
          : { searchText: { contains: normalizedQuery } }),
        ...(query.savedOnly ? { savedByUsers: { some: { userId } } } : {}),
      },
      include: foodItemInclude(userId),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit,
    });

    sendSuccess(response, { foodItems: foodItems.map(serializeFoodItem) });
  },
);

foodItemsRouter.get(
  '/barcode/:barcode',
  validateParams(foodBarcodeParamsSchema),
  validateQuery(foodBarcodeQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { barcode } = validatedParams<FoodBarcodeParams>(response);
    const { regionCode } = validatedQuery<FoodBarcodeQuery>(response);
    const normalizedRegionCode = regionCode?.trim().toLocaleUpperCase();
    const regionCandidates =
      normalizedRegionCode === undefined || normalizedRegionCode === 'GLOBAL'
        ? ['GLOBAL']
        : [normalizedRegionCode, 'GLOBAL'];

    const barcodeMatches = await prisma.foodBarcode.findMany({
      where: {
        barcode,
        regionCode: { in: regionCandidates },
        foodItem: visibleFoodWhere(userId),
      },
      include: {
        foodItem: {
          include: foodItemInclude(userId),
        },
      },
    });

    const match =
      barcodeMatches.find(
        (foodBarcode) => foodBarcode.regionCode === regionCandidates[0],
      ) ??
      barcodeMatches.find((foodBarcode) => foodBarcode.regionCode === 'GLOBAL');

    if (match === undefined) {
      throw notFoundError('Food barcode');
    }

    sendSuccess(response, serializeFoodItem(match.foodItem));
  },
);

foodItemsRouter.get(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const foodItem = await visibleFoodItem(id, userId);

    if (foodItem === null) {
      throw notFoundError('Food item');
    }

    sendSuccess(response, serializeFoodItem(foodItem));
  },
);

foodItemsRouter.post(
  '/',
  validateBody(foodItemInputSchema),
  async (_request, response) => {
    const input = validatedBody<FoodItemInput>(response);
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: currentUserId(response),
        sourceType: 'user_custom',
        sourceProvider: 'manual',
        ...normalizedFoodItem(input),
        nutrients: { create: nutrientRows(input.nutrients) },
      },
      include: foodItemInclude(currentUserId(response)),
    });

    sendSuccess(response, serializeFoodItem(foodItem));
  },
);

foodItemsRouter.put(
  '/:id',
  validateParams(idParamsSchema),
  validateBody(foodItemInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const existing = await editableCustomFoodItem(id, userId);

    if (existing === null) {
      throw notFoundError('Food item');
    }

    const input = validatedBody<FoodItemInput>(response);
    const foodItem = await prisma.foodItem.update({
      where: { id },
      data: {
        ...normalizedFoodItem(input),
        ...(hasNutrientInput(input)
          ? {
              nutrients: {
                deleteMany: {},
                create: nutrientRows(input.nutrients),
              },
            }
          : {}),
      },
      include: foodItemInclude(userId),
    });

    sendSuccess(response, serializeFoodItem(foodItem));
  },
);

foodItemsRouter.delete(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const existing = await editableCustomFoodItem(id, userId);

    if (existing === null) {
      throw notFoundError('Food item');
    }

    await prisma.foodItem.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    sendSuccess(response, { id, archived: true });
  },
);

foodItemsRouter.post(
  '/:id/save',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const foodItem = await visibleFoodItem(id, userId);

    if (foodItem === null) {
      throw notFoundError('Food item');
    }

    await prisma.savedFoodItem.upsert({
      where: { userId_foodItemId: { userId, foodItemId: id } },
      update: {},
      create: { userId, foodItemId: id },
    });

    sendSuccess(response, { id, saved: true });
  },
);

foodItemsRouter.delete(
  '/:id/save',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const foodItem = await visibleFoodItem(id, userId);

    if (foodItem === null) {
      throw notFoundError('Food item');
    }

    await prisma.savedFoodItem.deleteMany({
      where: { userId, foodItemId: id },
    });

    sendSuccess(response, { id, saved: false });
  },
);
