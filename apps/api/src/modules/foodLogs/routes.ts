import { Router, type RequestHandler } from 'express';
import {
  DEFAULT_TIMEZONE,
  foodLogFromAiEstimateInputSchema,
  type FoodLogFromAiEstimateInput,
  foodLogServingSnapshotSchema,
  type NormalizedNutrientMap,
  foodItemServingOptionsSchema,
  foodLogsFromCandidatesInputSchema,
  foodLogFromFoodItemInputSchema,
  foodLogsFromFoodItemsInputSchema,
  foodLogInputSchema,
  foodLogUpdateInputSchema,
  mixedMealCreateInputSchema,
  mixedMealPreviewInputSchema,
  foodLogSaveAsManualFoodInputSchema,
  foodLogsQuerySchema,
  idParamsSchema,
  validateServingQuantity,
  type FoodLogServingSnapshot,
} from '@food-tracker/shared';
import { Prisma, type NutrientKey, type NutrientUnit } from '@prisma/client';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { localDateRange } from '../../lib/dates.js';
import { AppError, notFoundError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sendSuccess } from '../../lib/responses.js';
import {
  roundTo,
  serializeFoodItem,
  serializeFoodLog,
} from '../../lib/serializers.js';
import {
  findOrCreateUsdaFoodItem,
  usdaFdcConfig,
} from '../foodItems/usda-fdc.js';
import {
  AuthoritativeServingInvariantError,
  calculateAuthoritativeServing,
  type AuthoritativeServingCalculationFailure,
  type AuthoritativeServingCalculationInput,
} from './serving-resolution.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validatedBody,
  validatedParams,
  validatedQuery,
} from '../../middleware/validate.js';
import { createMixedMeal, previewMixedMeal } from './mixed-meals.js';

type FoodLogInput = z.infer<typeof foodLogInputSchema>;
type FoodLogUpdateInput = z.infer<typeof foodLogUpdateInputSchema>;
type FoodLogFromFoodItemInput = z.infer<typeof foodLogFromFoodItemInputSchema>;
type FoodLogsFromFoodItemsInput = z.infer<
  typeof foodLogsFromFoodItemsInputSchema
>;
type FoodLogsFromCandidatesInput = z.infer<
  typeof foodLogsFromCandidatesInputSchema
>;
type FoodLogsQuery = z.infer<typeof foodLogsQuerySchema>;
type IdParams = z.infer<typeof idParamsSchema>;
type FoodLogSaveAsManualFoodInput = z.infer<
  typeof foodLogSaveAsManualFoodInputSchema
>;
type VisibleFoodItem = NonNullable<Awaited<ReturnType<typeof visibleFoodItem>>>;
type FoodItemServingRequest = Pick<
  FoodLogFromFoodItemInput,
  'serving' | 'servingMultiplier' | 'nutritionOverride'
>;

export const foodLogsRouter = Router();

foodLogsRouter.post(
  '/mixed-meals/preview',
  validateBody(mixedMealPreviewInputSchema),
  async (_request, response) => {
    sendSuccess(
      response,
      await previewMixedMeal(validatedBody(response), currentUserId(response)),
    );
  },
);

foodLogsRouter.post(
  '/mixed-meals',
  validateBody(mixedMealCreateInputSchema),
  async (_request, response) => {
    sendSuccess(
      response,
      await createMixedMeal(validatedBody(response), currentUserId(response)),
    );
  },
);

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

type ServingValidationIssue = {
  code: 'SERVING_CONFLICT' | 'INVALID_SERVING_REQUEST';
  itemIndex?: number;
};

function servingValidationIssue(issue: {
  path: readonly PropertyKey[];
  params?: Record<string, unknown> | undefined;
}): ServingValidationIssue | null {
  const itemIndex =
    issue.path[0] === 'items' && typeof issue.path[1] === 'number'
      ? issue.path[1]
      : undefined;
  if (issue.params?.code === 'SERVING_CONFLICT') {
    return {
      code: 'SERVING_CONFLICT',
      ...(itemIndex === undefined ? {} : { itemIndex }),
    };
  }
  return issue.path.some(
    (segment) => segment === 'serving' || segment === 'servingMultiplier',
  )
    ? {
        code: 'INVALID_SERVING_REQUEST',
        ...(itemIndex === undefined ? {} : { itemIndex }),
      }
    : null;
}

function validateAuthoritativeServingBody(schema: z.ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const issue = result.error.issues
        .map(servingValidationIssue)
        .find(
          (candidate): candidate is ServingValidationIssue =>
            candidate !== null,
        );
      const details =
        issue?.itemIndex === undefined ? {} : { itemIndex: issue.itemIndex };
      if (issue?.code === 'SERVING_CONFLICT') {
        next(
          new AppError(
            400,
            'SERVING_CONFLICT',
            'Provide either serving or servingMultiplier, not both.',
            details,
          ),
        );
        return;
      }
      if (issue?.code === 'INVALID_SERVING_REQUEST') {
        next(
          new AppError(
            400,
            'INVALID_SERVING_REQUEST',
            'The requested serving is invalid.',
            details,
          ),
        );
        return;
      }
      next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          result.error.issues[0]?.message ?? 'Request validation failed',
          { issues: result.error.issues },
        ),
      );
      return;
    }

    response.locals.validated = {
      ...(response.locals.validated as Record<string, unknown> | undefined),
      body: result.data,
    };
    next();
  };
}

const validateDirectFoodItemBody = validateAuthoritativeServingBody(
  foodLogFromFoodItemInputSchema,
);
const validateCandidatesBody = validateAuthoritativeServingBody(
  foodLogsFromCandidatesInputSchema,
);
const validateFoodItemsBody = validateAuthoritativeServingBody(
  foodLogsFromFoodItemsInputSchema,
);
const validateFoodLogUpdateBody = validateAuthoritativeServingBody(
  foodLogUpdateInputSchema,
);

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

function nutrientRows(
  input: FoodLogInput['nutrients'] | FoodLogUpdateInput['nutrients'],
) {
  return Object.entries(input ?? {}).map(([nutrientKey, nutrient]) => ({
    nutrientKey: nutrientKey as NutrientKey,
    amount: roundTo(nutrient.amount, 4),
    unit: nutrient.unit as NutrientUnit,
  }));
}

function hasNutrientInput(input: object): boolean {
  return Object.prototype.hasOwnProperty.call(input, 'nutrients');
}

function hasFoodItemInput(input: object): boolean {
  return Object.prototype.hasOwnProperty.call(input, 'foodItemId');
}

function hasOwnInput(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function hasDirectNutritionInput(input: FoodLogUpdateInput): boolean {
  return [
    'calories',
    'protein',
    'carbs',
    'fat',
    'fiber',
    'sugar',
    'sodium',
    'nutrients',
  ].some((key) => hasOwnInput(input, key));
}

function hasDirectServingInput(input: FoodLogUpdateInput): boolean {
  return ['servingQuantity', 'servingUnit'].some((key) =>
    hasOwnInput(input, key),
  );
}

function snapshotMetadataUpdateData(input: FoodLogUpdateInput) {
  return {
    ...(input.foodName === undefined ? {} : { foodName: input.foodName }),
    ...(input.mealType === undefined ? {} : { mealType: input.mealType }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.loggedAt === undefined
      ? {}
      : { loggedAt: new Date(input.loggedAt) }),
  };
}

function recipeLogMetadataUpdateData(input: FoodLogUpdateInput) {
  const immutableFields = new Set([
    'foodItemId',
    'foodName',
    'calories',
    'protein',
    'carbs',
    'fat',
    'fiber',
    'sugar',
    'sodium',
    'nutrients',
    'servingQuantity',
    'servingUnit',
    'serving',
    'clearNutritionOverride',
    'nutritionOverride',
    'servingSnapshot',
    'recipeId',
    'recipeSnapshot',
    'mixedMealSnapshot',
    'source',
    'sourceType',
    'sourceProvider',
    'sourceId',
    'provenance',
  ]);
  if (Object.keys(input).some((key) => immutableFields.has(key))) {
    throw new AppError(
      409,
      'RECIPE_LOG_IMMUTABLE',
      'Recipe-origin FoodLogs can only update meal type, logged time, and notes.',
    );
  }
  return {
    ...(input.mealType === undefined ? {} : { mealType: input.mealType }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.loggedAt === undefined
      ? {}
      : { loggedAt: new Date(input.loggedAt) }),
  };
}

function mixedMealLogMetadataUpdateData(input: FoodLogUpdateInput) {
  const immutableFields = new Set([
    'foodItemId',
    'foodName',
    'calories',
    'protein',
    'carbs',
    'fat',
    'fiber',
    'sugar',
    'sodium',
    'nutrients',
    'servingQuantity',
    'servingUnit',
    'serving',
    'clearNutritionOverride',
    'nutritionOverride',
    'servingSnapshot',
    'recipeId',
    'recipeSnapshot',
    'mixedMealSnapshot',
    'source',
    'sourceType',
    'sourceProvider',
    'sourceId',
    'provenance',
  ]);
  if (Object.keys(input).some((key) => immutableFields.has(key))) {
    throw new AppError(
      409,
      'MIXED_MEAL_LOG_IMMUTABLE',
      'Mixed-meal FoodLogs can only update meal type, logged time, and notes.',
    );
  }
  return {
    ...(input.mealType === undefined ? {} : { mealType: input.mealType }),
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    ...(input.loggedAt === undefined
      ? {}
      : { loggedAt: new Date(input.loggedAt) }),
  };
}

function foodItemNutritionBasis(foodItem: VisibleFoodItem):
  | (AuthoritativeServingCalculationInput['basisNutrition'] & {
      calories: number;
      protein: number;
    })
  | null {
  if (foodItem.calories === null || foodItem.protein === null) return null;

  return {
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
    ) as NormalizedNutrientMap,
  };
}

function foodItemServingInput(
  foodItem: VisibleFoodItem,
  input: FoodItemServingRequest,
): AuthoritativeServingCalculationInput {
  const basisNutrition = foodItemNutritionBasis(foodItem);
  if (basisNutrition === null) {
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

  if (foodItem.servingQuantity === null || foodItem.servingUnit === null) {
    throw new AppError(
      422,
      'INVALID_SERVING_BASIS',
      'This food item cannot be used for authoritative serving resolution.',
    );
  }

  const servingWeightGrams = foodItem.servingWeightGrams?.toNumber() ?? null;
  const equivalentWeightGrams =
    servingWeightGrams !== null &&
    validateServingQuantity(servingWeightGrams).success
      ? servingWeightGrams
      : null;
  const basisQuantity = foodItem.servingQuantity.toNumber();

  return {
    basis: {
      quantity: basisQuantity,
      unit: foodItem.servingUnit,
      displayText: `per ${basisQuantity} ${foodItem.servingUnit}`,
      equivalentWeightGrams,
      equivalentVolumeMl: null,
    },
    basisNutrition,
    servingOptions: foodItem.servingOptions,
    ...(input.serving === undefined
      ? {}
      : {
          serving: {
            quantity: input.serving.quantity,
            unit: input.serving.unit,
            ...(input.serving.servingOptionId === undefined
              ? {}
              : { servingOptionId: input.serving.servingOptionId }),
          },
        }),
    ...(input.servingMultiplier === undefined
      ? {}
      : { servingMultiplier: input.servingMultiplier }),
    ...(input.nutritionOverride === undefined
      ? {}
      : { nutritionOverride: input.nutritionOverride }),
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

function authoritativeServingFailureError(
  failure: AuthoritativeServingCalculationFailure,
): AppError {
  switch (failure.code) {
    case 'SERVING_CONFLICT':
      return new AppError(
        400,
        'SERVING_CONFLICT',
        'Provide either serving or servingMultiplier, not both.',
      );
    case 'INVALID_SERVING_REQUEST':
      return new AppError(
        400,
        'INVALID_SERVING_REQUEST',
        'The requested serving is invalid.',
        { reason: failure.reason },
      );
    case 'SERVING_NEEDS_REVIEW':
      return new AppError(
        422,
        'SERVING_NEEDS_REVIEW',
        'This serving needs review before it can be logged.',
        { status: 'needs_review', reason: failure.reason },
      );
    case 'SERVING_RESOLUTION_INVALID':
      return new AppError(
        400,
        'SERVING_RESOLUTION_INVALID',
        'The serving could not be resolved.',
        { reason: failure.reason },
      );
    case 'INVALID_SERVING_BASIS':
      return new AppError(
        422,
        'INVALID_SERVING_BASIS',
        'This food item cannot be used for authoritative serving resolution.',
      );
  }
}

function calculateFoodItemServing(
  foodItem: VisibleFoodItem,
  input: FoodItemServingRequest,
) {
  try {
    const result = calculateAuthoritativeServing(
      foodItemServingInput(foodItem, input),
    );
    if (!result.ok) throw authoritativeServingFailureError(result);
    return result;
  } catch (error) {
    if (error instanceof AuthoritativeServingInvariantError) {
      console.error('Authoritative serving snapshot invariant failed', {
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

function isExactlyStorableServingQuantity(quantity: number): boolean {
  return Math.abs(quantity - roundTo(quantity, 2)) < 1e-9;
}

function parsedServingSnapshotOrThrow(
  foodLogId: string,
  value: unknown,
): FoodLogServingSnapshot {
  const parsed = foodLogServingSnapshotSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  console.error('Stored FoodLog serving snapshot failed validation', {
    foodLogId,
  });
  throw new AppError(
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred',
  );
}

function requestedServingForSnapshotUpdate(
  snapshot: FoodLogServingSnapshot,
  input: FoodLogUpdateInput,
) {
  if (input.serving !== undefined) {
    return {
      quantity: input.serving.quantity,
      unit: input.serving.unit,
      ...(input.serving.servingOptionId === undefined
        ? {}
        : { servingOptionId: input.serving.servingOptionId }),
    };
  }

  const requestedServing = snapshot.requestedServing;
  return {
    quantity: requestedServing.quantity,
    unit: requestedServing.unit,
    ...(requestedServing.servingOptionId === null
      ? {}
      : { servingOptionId: requestedServing.servingOptionId }),
  };
}

function servingOptionUnavailableError(): AppError {
  return new AppError(
    422,
    'SERVING_OPTION_UNAVAILABLE',
    'The requested serving option is no longer available.',
  );
}

async function servingOptionsForSnapshotUpdate(
  snapshot: FoodLogServingSnapshot,
  serving: ReturnType<typeof requestedServingForSnapshotUpdate>,
  userId: string,
): Promise<AuthoritativeServingCalculationInput['servingOptions']> {
  const requestedOptionId = serving.servingOptionId;
  const frozenOption = snapshot.requestedServing.selectedServingOption;

  if (
    requestedOptionId !== undefined &&
    requestedOptionId !== null &&
    frozenOption !== null &&
    requestedOptionId === frozenOption.id
  ) {
    return { schemaVersion: 1, options: [frozenOption] };
  }

  if (requestedOptionId !== undefined && requestedOptionId !== null) {
    if (snapshot.provenance.basisOrigin !== 'food_item') {
      throw servingOptionUnavailableError();
    }

    const foodItem = await visibleFoodItem(
      snapshot.provenance.foodItemId,
      userId,
    );
    if (foodItem === null) throw servingOptionUnavailableError();

    const parsed = foodItemServingOptionsSchema.safeParse(
      foodItem.servingOptions,
    );
    const option = parsed.success
      ? parsed.data.options.find(
          (candidate) => candidate.id === requestedOptionId,
        )
      : undefined;
    if (option === undefined) throw servingOptionUnavailableError();

    return { schemaVersion: 1, options: [option] };
  }

  if (snapshot.provenance.basisOrigin !== 'food_item') return null;

  const foodItem = await visibleFoodItem(
    snapshot.provenance.foodItemId,
    userId,
  );
  return foodItem?.servingOptions ?? null;
}

function snapshotServingInput(
  snapshot: FoodLogServingSnapshot,
  serving: ReturnType<typeof requestedServingForSnapshotUpdate>,
  servingOptions: AuthoritativeServingCalculationInput['servingOptions'],
  nutritionOverride: FoodLogUpdateInput['nutritionOverride'],
): AuthoritativeServingCalculationInput {
  return {
    basis: {
      quantity: snapshot.nutritionBasis.quantity,
      unit: snapshot.nutritionBasis.unit,
      displayText: snapshot.nutritionBasis.displayText,
      equivalentWeightGrams: snapshot.nutritionBasis.equivalentWeightGrams,
      equivalentVolumeMl: snapshot.nutritionBasis.equivalentVolumeMl,
    },
    basisNutrition: snapshot.basisNutrition,
    servingOptions,
    serving,
    ...(nutritionOverride === undefined ? {} : { nutritionOverride }),
    provenance: snapshot.provenance,
  };
}

async function calculateSnapshotServing(input: {
  foodLogId: string;
  snapshot: FoodLogServingSnapshot;
  request: FoodLogUpdateInput;
  userId: string;
  nutritionOverride: FoodLogUpdateInput['nutritionOverride'];
}) {
  const serving = requestedServingForSnapshotUpdate(
    input.snapshot,
    input.request,
  );
  const servingOptions = await servingOptionsForSnapshotUpdate(
    input.snapshot,
    serving,
    input.userId,
  );

  try {
    const result = calculateAuthoritativeServing(
      snapshotServingInput(
        input.snapshot,
        serving,
        servingOptions,
        input.nutritionOverride,
      ),
    );
    if (!result.ok) throw authoritativeServingFailureError(result);
    return result;
  } catch (error) {
    if (error instanceof AuthoritativeServingInvariantError) {
      console.error('Authoritative serving snapshot invariant failed', {
        foodLogId: input.foodLogId,
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

function authoritativeFoodLogUpdateData(
  result: Awaited<ReturnType<typeof calculateSnapshotServing>>,
  foodLogId: string,
) {
  const requestedServing = result.servingSnapshot.requestedServing;
  if (!isExactlyStorableServingQuantity(requestedServing.quantity)) {
    throw new AppError(
      400,
      'INVALID_SERVING_REQUEST',
      'The requested serving cannot be stored precisely.',
      { reason: 'invalid_quantity' },
    );
  }

  const finalNutrition = result.finalNutrition;
  if (finalNutrition.calories === null || finalNutrition.protein === null) {
    console.error('Authoritative serving result omitted required nutrition', {
      foodLogId,
    });
    throw new AppError(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
    );
  }

  return {
    calories: finalNutrition.calories,
    protein: finalNutrition.protein,
    carbs: finalNutrition.carbs,
    fat: finalNutrition.fat,
    fiber: finalNutrition.fiber,
    sugar: finalNutrition.sugar,
    sodium: finalNutrition.sodium,
    servingQuantity: requestedServing.quantity,
    servingUnit: requestedServing.unit,
    servingSnapshot: result.servingSnapshot,
    nutrients: {
      deleteMany: {},
      create: result.finalNutrients,
    },
  };
}

function authoritativeFoodLogData(
  foodItem: VisibleFoodItem,
  input: FoodItemServingRequest & {
    mealType: FoodLogFromFoodItemInput['mealType'];
    loggedAt: string;
    notes?: string | null | undefined;
  },
) {
  const result = calculateFoodItemServing(foodItem, input);
  const requestedServing = result.servingSnapshot.requestedServing;
  if (!isExactlyStorableServingQuantity(requestedServing.quantity)) {
    throw new AppError(
      400,
      'INVALID_SERVING_REQUEST',
      'The requested serving cannot be stored precisely.',
      { reason: 'invalid_quantity' },
    );
  }

  const finalNutrition = result.finalNutrition;
  const finalCalories = finalNutrition.calories;
  const finalProtein = finalNutrition.protein;
  if (finalCalories === null || finalProtein === null) {
    console.error('Authoritative serving result omitted required nutrition', {
      foodItemId: foodItem.id,
    });
    throw new AppError(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
    );
  }

  return {
    foodItemId: foodItem.id,
    foodName: foodItem.name,
    mealType: input.mealType,
    calories: finalCalories,
    protein: finalProtein,
    carbs: finalNutrition.carbs,
    fat: finalNutrition.fat,
    fiber: finalNutrition.fiber,
    sugar: finalNutrition.sugar,
    sodium: finalNutrition.sodium,
    notes: input.notes ?? null,
    servingQuantity: requestedServing.quantity,
    servingUnit: requestedServing.unit,
    servingSnapshot: result.servingSnapshot,
    loggedAt: new Date(input.loggedAt),
    nutrients: { create: result.finalNutrients },
  };
}

function withServingItemIndex(error: unknown, itemIndex: number): unknown {
  if (
    error instanceof AppError &&
    (error.code === 'SERVING_CONFLICT' ||
      error.code === 'INVALID_SERVING_REQUEST' ||
      error.code === 'SERVING_NEEDS_REVIEW' ||
      error.code === 'SERVING_RESOLUTION_INVALID' ||
      error.code === 'INVALID_SERVING_BASIS')
  ) {
    return new AppError(error.status, error.code, error.message, {
      ...error.details,
      itemIndex,
    });
  }
  return error;
}

const foodLogInclude = {
  nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] },
};

function reusableFoodLogError(reason: string) {
  return new AppError(
    422,
    'FOOD_LOG_NOT_REUSABLE',
    'This FoodLog cannot be saved as a manual food.',
    { reason },
  );
}

function reusableServingSnapshot(foodLog: {
  servingSnapshot: Prisma.JsonValue | null;
}) {
  const parsed = foodLogServingSnapshotSchema.safeParse(
    foodLog.servingSnapshot,
  );
  if (!parsed.success) throw reusableFoodLogError('unsupported_serving');
  return parsed.data;
}

function manuallyDerivedFoodData(
  foodLog: {
    foodName: string;
    calories: number;
    protein: Prisma.Decimal;
    carbs: Prisma.Decimal | null;
    fat: Prisma.Decimal | null;
    fiber: Prisma.Decimal | null;
    sugar: Prisma.Decimal | null;
    sodium: number | null;
  },
  snapshot: FoodLogServingSnapshot,
  input: FoodLogSaveAsManualFoodInput,
) {
  if (foodLog.carbs === null || foodLog.fat === null)
    throw reusableFoodLogError('incomplete_nutrition');
  const quantity = snapshot.requestedServing.quantity;
  const unit = snapshot.requestedServing.unit;
  const name = input.name ?? foodLog.foodName;
  const normalizedName = name.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const option = snapshot.requestedServing.selectedServingOption;
  const servingOptions =
    option === null ? Prisma.JsonNull : { schemaVersion: 1, options: [option] };
  return {
    name,
    description: input.description ?? null,
    normalizedName,
    normalizedBrandName: null,
    searchText: normalizedName,
    sourceType: 'user_custom' as const,
    sourceProvider: 'manual' as const,
    foodType: 'generic' as const,
    servingQuantity: quantity,
    servingUnit: unit,
    servingWeightGrams:
      snapshot.resolution.resolvedWeightGrams ??
      snapshot.nutritionBasis.equivalentWeightGrams,
    servingOptions: servingOptions as Prisma.InputJsonValue,
    calories: foodLog.calories,
    protein: foodLog.protein,
    carbs: foodLog.carbs,
    fat: foodLog.fat,
    fiber: foodLog.fiber,
    sugar: foodLog.sugar,
    sodium: foodLog.sodium,
  };
}

foodLogsRouter.post(
  '/:id/save-as-manual-food',
  validateParams(idParamsSchema),
  validateBody(foodLogSaveAsManualFoodInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const input = validatedBody<FoodLogSaveAsManualFoodInput>(response);
    const foodItem = await prisma.$transaction(async (tx) => {
      const existing = await tx.foodItem.findUnique({
        where: { derivedFromFoodLogId: id },
        include: {
          nutrients: { orderBy: { nutrientKey: 'asc' } },
          barcodes: true,
          savedByUsers: { where: { userId }, select: { id: true } },
          servingPreferences: {
            where: { userId },
            select: {
              defaultServingQuantity: true,
              defaultServingUnit: true,
              defaultServingOptionId: true,
            },
          },
        },
      });
      if (existing !== null) return existing;
      const foodLog = await tx.foodLog.findFirst({
        where: { id, userId },
        include: { nutrients: { orderBy: { nutrientKey: 'asc' } } },
      });
      if (foodLog === null) throw notFoundError('Food log');
      if (foodLog.recipeSnapshot !== null)
        throw reusableFoodLogError('recipe_origin');
      if (foodLog.mixedMealSnapshot !== null)
        throw reusableFoodLogError('mixed_meal_origin');
      const snapshot = reusableServingSnapshot(foodLog);
      if (snapshot.provenance.basisOrigin === 'ai_estimate')
        throw reusableFoodLogError('ai_estimated');
      if (
        snapshot.provenance.basisOrigin === 'food_item' &&
        snapshot.provenance.sourceType !== 'user_custom' &&
        snapshot.nutritionOverride === null
      )
        throw reusableFoodLogError('missing_persisted_override');
      const data = manuallyDerivedFoodData(foodLog, snapshot, input);
      try {
        return await tx.foodItem.create({
          data: {
            userId,
            derivedFromFoodLogId: id,
            ...data,
            nutrients: {
              create: foodLog.nutrients.map((nutrient) => ({
                nutrientKey: nutrient.nutrientKey,
                amount: nutrient.amount,
                unit: nutrient.unit,
              })),
            },
          },
          include: {
            nutrients: { orderBy: { nutrientKey: 'asc' } },
            barcodes: true,
            savedByUsers: { where: { userId }, select: { id: true } },
            servingPreferences: {
              where: { userId },
              select: {
                defaultServingQuantity: true,
                defaultServingUnit: true,
                defaultServingOptionId: true,
              },
            },
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return tx.foodItem.findUniqueOrThrow({
            where: { derivedFromFoodLogId: id },
            include: {
              nutrients: { orderBy: { nutrientKey: 'asc' } },
              barcodes: true,
              savedByUsers: { where: { userId }, select: { id: true } },
              servingPreferences: {
                where: { userId },
                select: {
                  defaultServingQuantity: true,
                  defaultServingUnit: true,
                  defaultServingOptionId: true,
                },
              },
            },
          });
        }
        throw error;
      }
    });
    sendSuccess(response, serializeFoodItem(foodItem));
  },
);

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
  validateDirectFoodItemBody,
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodLogFromFoodItemInput>(response);
    const foodItem = await visibleFoodItem(input.foodItemId, userId);

    if (foodItem === null) {
      throw notFoundError('Food item');
    }

    const data = authoritativeFoodLogData(foodItem, input);
    const foodLog = await prisma.$transaction((tx) =>
      tx.foodLog.create({
        data: {
          userId,
          ...data,
        },
        include: foodLogInclude,
      }),
    );

    sendSuccess(response, serializeFoodLog(foodLog));
  },
);

foodLogsRouter.post(
  '/from-food-items',
  validateFoodItemsBody,
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodLogsFromFoodItemsInput>(response);

    const foodLogs = await prisma.$transaction(async (tx) => {
      const foodLogData = [];

      for (const [itemIndex, item] of input.items.entries()) {
        const foodItem = await visibleFoodItemInTransaction(
          tx,
          item.foodItemId,
          userId,
        );

        if (foodItem === null) {
          throw notFoundError('Food item');
        }

        try {
          foodLogData.push(
            authoritativeFoodLogData(foodItem, {
              ...item,
              mealType: input.mealType,
              loggedAt: input.loggedAt,
              notes: input.notes,
            }),
          );
        } catch (error) {
          throw withServingItemIndex(error, itemIndex);
        }
      }

      const createdFoodLogs = [];
      for (const data of foodLogData) {
        createdFoodLogs.push(
          await tx.foodLog.create({
            data: { userId, ...data },
            include: foodLogInclude,
          }),
        );
      }
      return createdFoodLogs;
    });

    sendSuccess(response, { foodLogs: foodLogs.map(serializeFoodLog) });
  },
);

foodLogsRouter.post(
  '/from-candidates',
  validateCandidatesBody,
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodLogsFromCandidatesInput>(response);
    const usdaConfig = usdaFdcConfig();

    const foodLogs = await prisma.$transaction(async (tx) => {
      const foodLogData = [];

      for (const [itemIndex, item] of input.items.entries()) {
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

        try {
          foodLogData.push(
            authoritativeFoodLogData(foodItem, {
              ...item,
              mealType: input.mealType,
              loggedAt: input.loggedAt,
              notes: input.notes,
            }),
          );
        } catch (error) {
          throw withServingItemIndex(error, itemIndex);
        }
      }

      const createdFoodLogs = [];
      for (const data of foodLogData) {
        createdFoodLogs.push(
          await tx.foodLog.create({
            data: { userId, ...data },
            include: foodLogInclude,
          }),
        );
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
  validateFoodLogUpdateBody,
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const existing = await prisma.foodLog.findFirst({ where: { id, userId } });

    if (existing === null) {
      throw notFoundError('Food log');
    }

    const input = validatedBody<FoodLogUpdateInput>(response);

    if (existing.mixedMealSnapshot !== null) {
      const foodLog = await prisma.foodLog.update({
        where: { id },
        data: mixedMealLogMetadataUpdateData(input),
        include: foodLogInclude,
      });
      sendSuccess(response, serializeFoodLog(foodLog));
      return;
    }

    if (existing.recipeSnapshot !== null) {
      const foodLog = await prisma.foodLog.update({
        where: { id },
        data: recipeLogMetadataUpdateData(input),
        include: foodLogInclude,
      });
      sendSuccess(response, serializeFoodLog(foodLog));
      return;
    }

    if (existing.servingSnapshot === null) {
      if (
        input.serving !== undefined ||
        input.nutritionOverride !== undefined ||
        input.clearNutritionOverride === true
      ) {
        throw new AppError(
          422,
          'SERVING_UPDATE_UNAVAILABLE',
          'This historical log has no serving basis for recalculation.',
        );
      }

      const legacyInput = foodLogInputSchema.safeParse(_request.body);
      if (!legacyInput.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          legacyInput.error.issues[0]?.message ?? 'Request validation failed',
          { issues: legacyInput.error.issues },
        );
      }
      const foodItemId = hasFoodItemInput(legacyInput.data)
        ? await verifiedFoodItemId(legacyInput.data.foodItemId, userId)
        : undefined;

      const foodLog = await prisma.foodLog.update({
        where: { id },
        data: {
          ...normalizedFoodLog(legacyInput.data),
          ...(foodItemId === undefined ? {} : { foodItemId }),
          ...(hasNutrientInput(legacyInput.data)
            ? {
                nutrients: {
                  deleteMany: {},
                  create: nutrientRows(legacyInput.data.nutrients),
                },
              }
            : {}),
        },
        include: foodLogInclude,
      });
      sendSuccess(response, serializeFoodLog(foodLog));
      return;
    }

    const snapshot = parsedServingSnapshotOrThrow(
      existing.id,
      existing.servingSnapshot,
    );
    const foodItemId = hasFoodItemInput(input)
      ? await verifiedFoodItemId(input.foodItemId, userId)
      : undefined;
    const hasServingUpdate = input.serving !== undefined;
    const hasReplacementOverride = input.nutritionOverride !== undefined;
    const clearNutritionOverride = input.clearNutritionOverride === true;

    if (clearNutritionOverride && hasReplacementOverride) {
      throw new AppError(
        400,
        'SERVING_UPDATE_CONFLICT',
        'Provide either a replacement nutrition override or clear it, not both.',
      );
    }

    if (hasServingUpdate && hasDirectNutritionInput(input)) {
      throw new AppError(
        400,
        'SERVING_UPDATE_CONFLICT',
        'Serving updates cannot include direct nutrient totals.',
      );
    }

    if (hasServingUpdate && hasDirectServingInput(input)) {
      throw new AppError(
        400,
        'SERVING_UPDATE_CONFLICT',
        'Serving updates cannot include legacy serving fields.',
      );
    }

    if (!hasServingUpdate && hasDirectNutritionInput(input)) {
      throw new AppError(
        409,
        'SNAPSHOT_NUTRITION_EDIT_REQUIRES_OVERRIDE',
        'Snapshot-backed nutrition must be changed with nutritionOverride.',
      );
    }

    if (!hasServingUpdate && hasDirectServingInput(input)) {
      throw new AppError(
        400,
        'SERVING_UPDATE_CONFLICT',
        'Snapshot-backed serving must be changed with serving.',
      );
    }

    if (clearNutritionOverride && snapshot.nutritionOverride === null) {
      throw new AppError(
        400,
        'SERVING_UPDATE_CONFLICT',
        'There is no nutrition override to clear.',
      );
    }

    if (
      hasServingUpdate &&
      snapshot.nutritionOverride !== null &&
      !clearNutritionOverride &&
      !hasReplacementOverride
    ) {
      throw new AppError(
        409,
        'SERVING_OVERRIDE_ACTION_REQUIRED',
        'Changing this serving requires clearing or replacing its nutrition override.',
      );
    }

    const requiresRecalculation =
      hasServingUpdate || hasReplacementOverride || clearNutritionOverride;
    if (!requiresRecalculation) {
      const foodLog = await prisma.foodLog.update({
        where: { id },
        data: {
          ...snapshotMetadataUpdateData(input),
          ...(foodItemId === undefined ? {} : { foodItemId }),
        },
        include: foodLogInclude,
      });
      sendSuccess(response, serializeFoodLog(foodLog));
      return;
    }

    const result = await calculateSnapshotServing({
      foodLogId: existing.id,
      snapshot,
      request: input,
      userId,
      nutritionOverride: clearNutritionOverride
        ? undefined
        : input.nutritionOverride,
    });
    const authoritativeData = authoritativeFoodLogUpdateData(
      result,
      existing.id,
    );
    const foodLog = await prisma.$transaction((tx) =>
      tx.foodLog.update({
        where: { id },
        data: {
          ...snapshotMetadataUpdateData(input),
          ...(foodItemId === undefined ? {} : { foodItemId }),
          ...authoritativeData,
        },
        include: foodLogInclude,
      }),
    );
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
