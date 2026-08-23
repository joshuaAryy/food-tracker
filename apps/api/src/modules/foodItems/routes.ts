import { Router } from 'express';
import {
  foodBarcodeParamsSchema,
  foodBarcodeLookupInputSchema,
  foodBarcodeQuerySchema,
  foodItemExternalCandidateInputSchema,
  foodItemInputSchema,
  foodItemServingOptionsSchema,
  manualFoodItemCreateInputSchema,
  manualFoodItemUpdateInputSchema,
  foodItemSearchCandidatesInputSchema,
  foodItemsQuerySchema,
  foodLibraryQuerySchema,
  foodItemDefaultServingInputSchema,
  idParamsSchema,
  classifyServingUnit,
  type ServingUnit,
  type AiFoodParseCandidate,
} from '@food-tracker/shared';
import { Prisma, type NutrientKey, type NutrientUnit } from '@prisma/client';
import type { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { AppError, notFoundError } from '../../lib/errors.js';
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
import {
  fetchOpenFoodFactsProduct,
  openFoodFactsData,
  type NormalizedOpenFoodFactsFood,
} from './open-food-facts.js';
import {
  enrichUsdaFoods,
  defaultWholeItemServingFromOptions,
  USDA_ENRICHMENT_POLICIES,
  usdaFdcConfig,
  type NormalizedUsdaFood,
} from './usda-fdc.js';
import {
  findOrCreateExternalFoodItem,
  withExternalFoodMaterializationLock,
} from './external-food.js';
import {
  externalSearchQuery,
  normalizeText,
  queryVariants,
  rankParseCandidates,
} from './candidate-ranking.js';
import { retrieveFuzzyFoodItemMatches } from './retrieval/fuzzy.js';
import { createPineconeSemanticClient } from './retrieval/pinecone.js';
import {
  appendUniqueCandidate,
  candidateMatchReason,
  foodItemCandidate,
} from './retrieval/candidate-generation.js';
import { calculateAuthoritativeServing } from '../foodLogs/serving-resolution.js';
import { createRequestRateLimitKey } from '../ai/rate-limit-key.js';

type FoodItemInput = z.infer<typeof foodItemInputSchema>;
type ManualFoodItemCreateInput = z.infer<
  typeof manualFoodItemCreateInputSchema
>;
type ManualFoodItemUpdateInput = z.infer<
  typeof manualFoodItemUpdateInputSchema
>;
type ManualPerServingBasis = {
  mode: 'per_serving';
  quantity: number;
  unit: ServingUnit;
  equivalentWeightGrams?: number | null;
  equivalentVolumeMl?: number | null;
};
type FoodItemsQuery = z.infer<typeof foodItemsQuerySchema>;
type FoodItemSearchCandidatesInput = z.infer<
  typeof foodItemSearchCandidatesInputSchema
>;
type FoodItemExternalCandidateInput = z.infer<
  typeof foodItemExternalCandidateInputSchema
>;
type FoodBarcodeLookupInput = z.infer<typeof foodBarcodeLookupInputSchema>;
type FoodBarcodeParams = z.infer<typeof foodBarcodeParamsSchema>;
type FoodBarcodeQuery = z.infer<typeof foodBarcodeQuerySchema>;
type IdParams = z.infer<typeof idParamsSchema>;
type FoodLibraryQuery = z.infer<typeof foodLibraryQuerySchema>;
type DefaultServingInput = z.infer<typeof foodItemDefaultServingInputSchema>;

export const foodItemsRouter = Router();

function searchTextWhere(value: string): Prisma.FoodItemWhereInput {
  return {
    OR: queryVariants(value).map((variant) => ({
      searchText: { contains: variant },
    })),
  };
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

function manualNutrientRows(
  input: ManualFoodItemCreateInput['nutrition']['nutrients'],
) {
  return Object.entries(input ?? {}).map(([nutrientKey, nutrient]) => ({
    nutrientKey: nutrientKey as NutrientKey,
    amount: roundTo(nutrient.amount, 4),
    unit: nutrient.unit as NutrientUnit,
  }));
}

function manualServingOptions(input: ManualFoodItemCreateInput) {
  const options = input.servingOptions?.options ?? [];
  const basis = input.basis;
  const perServingBasis =
    basis.mode === 'per_serving' ? (basis as ManualPerServingBasis) : null;
  const equivalence =
    perServingBasis !== null
      ? (perServingBasis.equivalentWeightGrams ??
        perServingBasis.equivalentVolumeMl ??
        null)
      : null;
  const generated =
    equivalence === null || perServingBasis === null
      ? []
      : [
          {
            id: 'manual-basis-equivalence',
            label: `1 ${perServingBasis.unit}`,
            quantity: perServingBasis.quantity,
            unit: perServingBasis.unit,
            unitFamily: classifyServingUnit(perServingBasis.unit)!.family,
            equivalentWeightGrams:
              perServingBasis.equivalentWeightGrams ?? null,
            equivalentVolumeMl: perServingBasis.equivalentVolumeMl ?? null,
            source: 'manual' as const,
            trust: 'trusted' as const,
            provider: null,
            providerDescription: null,
          },
        ];
  if (generated.length === 0 && options.length === 0) return null;
  const parsed = foodItemServingOptionsSchema.safeParse({
    schemaVersion: 1,
    options: [...generated, ...options],
  });
  if (!parsed.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Serving options are invalid.',
      {
        issues: parsed.error.issues,
      },
    );
  }
  if (
    parsed.data.options.some(
      (option) => option.source !== 'manual' || option.provider !== null,
    )
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Manual foods may only use user-entered trusted serving options.',
    );
  }
  return parsed.data;
}

function manualFoodItemData(input: ManualFoodItemCreateInput) {
  const per100g = input.basis.mode === 'per_100g';
  const perServingBasis = per100g
    ? null
    : (input.basis as ManualPerServingBasis);
  const servingQuantity = per100g ? 100 : perServingBasis!.quantity;
  const servingUnit = per100g ? 'g' : perServingBasis!.unit;
  const servingWeightGrams = per100g
    ? 100
    : (perServingBasis!.equivalentWeightGrams ?? null);
  return {
    name: input.name.trim(),
    brandName: input.brandName?.trim() ?? null,
    description: input.description?.trim() ?? null,
    foodType: 'generic' as const,
    ...searchText({ name: input.name, brandName: input.brandName }),
    servingQuantity,
    servingUnit,
    servingWeightGrams,
    servingOptions: (manualServingOptions(input) ??
      Prisma.JsonNull) as Prisma.InputJsonValue,
    calories: Math.round(input.nutrition.calories),
    protein: roundTo(input.nutrition.protein, 1),
    carbs: roundTo(input.nutrition.carbs, 1),
    fat: roundTo(input.nutrition.fat, 1),
    fiber:
      input.nutrition.fiber == null ? null : roundTo(input.nutrition.fiber, 1),
    sugar:
      input.nutrition.sugar == null ? null : roundTo(input.nutrition.sugar, 1),
    sodium:
      input.nutrition.sodium == null
        ? null
        : Math.round(input.nutrition.sodium),
  };
}

function manualRecordInput(
  foodItem: Awaited<ReturnType<typeof editableManualFoodItem>> & {},
): ManualFoodItemCreateInput {
  const servingQuantityDecimal = foodItem?.servingQuantity;
  if (
    foodItem === null ||
    servingQuantityDecimal === null ||
    foodItem.servingUnit === null ||
    foodItem.calories === null ||
    foodItem.protein === null ||
    foodItem.carbs === null ||
    foodItem.fat === null
  ) {
    throw new AppError(
      422,
      'INVALID_SERVING_BASIS',
      'This manual food is missing a valid nutrition basis.',
    );
  }
  const options = foodItemServingOptionsSchema.safeParse(
    foodItem.servingOptions,
  );
  const servingQuantity = servingQuantityDecimal.toNumber();
  const basisOption = options.success
    ? options.data.options.find(
        (option) =>
          option.unit === foodItem.servingUnit &&
          option.quantity === servingQuantity,
      )
    : undefined;
  const basis =
    servingQuantity === 100 && foodItem.servingUnit === 'g'
      ? { mode: 'per_100g' as const }
      : {
          mode: 'per_serving' as const,
          quantity: servingQuantity,
          unit: foodItem.servingUnit as ServingUnit,
          ...(basisOption?.equivalentWeightGrams === null ||
          basisOption?.equivalentWeightGrams === undefined
            ? {}
            : { equivalentWeightGrams: basisOption.equivalentWeightGrams }),
          ...(basisOption?.equivalentVolumeMl === null ||
          basisOption?.equivalentVolumeMl === undefined
            ? {}
            : { equivalentVolumeMl: basisOption.equivalentVolumeMl }),
        };
  return {
    name: foodItem.name,
    brandName: foodItem.brandName,
    description: foodItem.description,
    basis,
    nutrition: {
      calories: foodItem.calories,
      protein: foodItem.protein.toNumber(),
      carbs: foodItem.carbs.toNumber(),
      fat: foodItem.fat.toNumber(),
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
    servingOptions: options.success ? options.data : null,
  } as ManualFoodItemCreateInput;
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
    servingPreferences: {
      where: { userId },
      select: {
        defaultServingQuantity: true,
        defaultServingUnit: true,
        defaultServingOptionId: true,
      },
    },
    foodLogs: {
      where: { userId },
      select: { loggedAt: true },
      orderBy: { loggedAt: 'desc' as const },
      take: 1,
    },
  };
}

async function visibleFoodItem(id: string, userId: string) {
  return prisma.foodItem.findFirst({
    where: { id, ...visibleFoodWhere(userId) },
    include: foodItemInclude(userId),
  });
}

function needsAdditionalCoverage(
  query: string,
  candidates: AiFoodParseCandidate[],
  requestedLimit: number,
): boolean {
  const topK = rankParseCandidates(query, candidates).slice(
    0,
    Math.min(requestedLimit, 3),
  );
  const providerDiversity = new Set(
    topK.map((candidate) => candidate.matchReason),
  );
  return (
    topK.length < Math.min(requestedLimit, 3) ||
    (topK.length > 1 && providerDiversity.size < 2)
  );
}

function usdaExternalCandidate(
  food: NormalizedUsdaFood,
  rank: number,
): AiFoodParseCandidate {
  const servingOptions = foodItemServingOptionsSchema.safeParse(
    food.servingOptions,
  ).success
    ? foodItemServingOptionsSchema.parse(food.servingOptions)
    : null;
  return {
    candidateType: 'external_food',
    foodItem: null,
    externalFood: {
      sourceProvider: 'usda_fdc',
      sourceId: food.sourceId,
      name: food.name,
      brandName: food.brandName,
      foodType: food.foodType,
      servingBasisText: food.servingBasisText,
      servingQuantity: food.servingQuantity,
      servingUnit: food.servingUnit,
      servingWeightGrams: food.servingWeightGrams,
      servingOptions,
      defaultWholeItemServing:
        defaultWholeItemServingFromOptions(servingOptions),
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      sugar: food.sugar,
      sodium: food.sodium,
      nutrients: Object.fromEntries(
        food.nutrients.map((nutrient) => [
          nutrient.nutrientKey,
          { amount: nutrient.amount, unit: nutrient.unit },
        ]),
      ),
    },
    rank,
    matchReason: 'usda_fdc',
    confidence: 'low',
    defaultServingMultiplier: 1,
  };
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

async function editableManualFoodItem(id: string, userId: string) {
  return prisma.foodItem.findFirst({
    where: {
      id,
      userId,
      sourceType: 'user_custom',
      sourceProvider: 'manual',
      archivedAt: null,
    },
    include: { nutrients: { orderBy: { nutrientKey: 'asc' } } },
  });
}

function barcodeRegionCandidates(regionCode: string | undefined): string[] {
  const normalizedRegionCode = regionCode?.trim().toLocaleUpperCase();
  return normalizedRegionCode === undefined || normalizedRegionCode === 'GLOBAL'
    ? ['GLOBAL']
    : [normalizedRegionCode, 'GLOBAL'];
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function barcodeCandidates(values: string[]): string[] {
  const candidates: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (digits === '') {
      continue;
    }

    if (digits.length === 13 && digits.startsWith('0')) {
      candidates.push(digits.slice(1));
      candidates.push(digits);
      continue;
    }

    candidates.push(digits);

    if (digits.length === 12) {
      candidates.push(`0${digits}`);
    }
  }

  return uniqueValues(candidates).filter((candidate) =>
    [6, 8, 12, 13].includes(candidate.length),
  );
}

async function lookupLocalBarcodeFoodItem(input: {
  barcodes: string[];
  regionCandidates: string[];
  userId: string;
}) {
  const barcodeMatches = await prisma.foodBarcode.findMany({
    where: {
      barcode: { in: input.barcodes },
      regionCode: { in: input.regionCandidates },
      foodItem: visibleFoodWhere(input.userId),
    },
    include: {
      foodItem: {
        include: foodItemInclude(input.userId),
      },
    },
  });

  const match = input.regionCandidates
    .flatMap((regionCode) =>
      input.barcodes.map((barcode) =>
        barcodeMatches.find(
          (foodBarcode) =>
            foodBarcode.regionCode === regionCode &&
            foodBarcode.barcode === barcode,
        ),
      ),
    )
    .find((foodBarcode) => foodBarcode !== undefined);

  return match?.foodItem ?? null;
}

async function fetchFirstOpenFoodFactsProduct(barcodes: string[]): Promise<{
  food: NormalizedOpenFoodFactsFood;
  barcode: string;
} | null> {
  for (const barcode of barcodes) {
    const food = await fetchOpenFoodFactsProduct(barcode);

    if (food !== null) {
      return { food, barcode };
    }
  }

  return null;
}

function cacheBarcodeCandidates(input: {
  food: NormalizedOpenFoodFactsFood;
  lookupCandidates: string[];
  matchedBarcode: string;
  regionCode: string;
}) {
  const sourceCandidates = barcodeCandidates([input.food.sourceId]);
  const primaryBarcode =
    sourceCandidates[0] ?? input.lookupCandidates[0] ?? input.matchedBarcode;
  const aliasCandidates = barcodeCandidates([
    primaryBarcode,
    input.matchedBarcode,
    ...input.lookupCandidates,
    ...sourceCandidates,
  ]);

  return uniqueValues([primaryBarcode, ...aliasCandidates]).map((barcode) => ({
    barcode,
    regionCode: input.regionCode,
  }));
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

foodItemsRouter.post(
  '/manual',
  validateBody(manualFoodItemCreateInputSchema),
  async (_request, response) => {
    const input = validatedBody<ManualFoodItemCreateInput>(response);
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: currentUserId(response),
        sourceType: 'user_custom',
        sourceProvider: 'manual',
        rankingClass: 'user_priority',
        ...manualFoodItemData(input),
        nutrients: { create: manualNutrientRows(input.nutrition.nutrients) },
      },
      include: foodItemInclude(currentUserId(response)),
    });
    sendSuccess(response, serializeFoodItem(foodItem));
  },
);

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

foodItemsRouter.post(
  '/search-candidates',
  validateBody(foodItemSearchCandidatesInputSchema),
  async (request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodItemSearchCandidatesInput>(response);
    const normalizedQuery = normalizeText(input.query);
    let candidates: AiFoodParseCandidate[] = [];
    const seen = new Set<string>();

    const localFoods = await prisma.foodItem.findMany({
      where: {
        AND: [visibleFoodWhere(userId), searchTextWhere(normalizedQuery)],
      },
      include: foodItemInclude(userId),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: input.limit,
    });

    for (const foodItem of localFoods) {
      const serialized = serializeFoodItem(foodItem);
      appendUniqueCandidate({
        candidates,
        seen,
        candidate: foodItemCandidate({
          foodItem: serialized,
          matchReason: candidateMatchReason({
            sourceType: foodItem.sourceType,
            sourceProvider: serialized.sourceProvider,
            hasBarcode: foodItem.barcodes.length > 0,
            isSaved: serialized.isSaved,
            isRecent: foodItem.foodLogs.length > 0,
          }),
          rank: candidates.length + 1,
        }),
      });
    }

    if (needsAdditionalCoverage(normalizedQuery, candidates, input.limit)) {
      try {
        const fuzzyMatches = await retrieveFuzzyFoodItemMatches({
          prisma,
          query: normalizedQuery,
          limit: Math.max(input.limit * 2, 10),
          userId,
        });
        const fuzzyIds = fuzzyMatches.map((match) => match.id);
        const fuzzyDistanceById = new Map(
          fuzzyMatches.map((match) => [match.id, match.distance]),
        );
        const fuzzyFoods = await prisma.foodItem.findMany({
          where: { AND: [visibleFoodWhere(userId), { id: { in: fuzzyIds } }] },
          include: foodItemInclude(userId),
        });
        const byId = new Map(fuzzyFoods.map((food) => [food.id, food]));
        for (const id of fuzzyIds) {
          const foodItem = byId.get(id);
          if (foodItem === undefined || seen.has(foodItem.id)) continue;
          const serialized = serializeFoodItem(foodItem);
          appendUniqueCandidate({
            candidates,
            seen,
            candidate: foodItemCandidate({
              foodItem: serialized,
              matchReason: candidateMatchReason({
                sourceType: foodItem.sourceType,
                sourceProvider: serialized.sourceProvider,
                hasBarcode: foodItem.barcodes.length > 0,
                isSaved: serialized.isSaved,
                isRecent: foodItem.foodLogs.length > 0,
              }),
              rank: candidates.length + 1,
              retrievalEvidence: {
                lexical: false,
                fuzzyDistance: fuzzyDistanceById.get(id) ?? null,
                semanticScore: null,
              },
            }),
          });
        }
      } catch {
        // The lexical path remains authoritative if trigram retrieval is unavailable.
      }
    }

    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeHost = process.env.PINECONE_INDEX_HOST;
    if (
      needsAdditionalCoverage(normalizedQuery, candidates, input.limit) &&
      pineconeApiKey &&
      pineconeHost
    ) {
      try {
        const semantic = createPineconeSemanticClient({
          apiKey: pineconeApiKey,
          indexHost: pineconeHost,
          namespace: process.env.PINECONE_ACTIVE_NAMESPACE ?? 'food-search-v1',
          topK: Math.max(input.limit * 2, 10),
        });
        const matches = await semantic.search(normalizedQuery, 350);
        const semanticIds = matches
          .map((match) => match.foodItemId)
          .filter((id) => !seen.has(id));
        const semanticFoods = await prisma.foodItem.findMany({
          where: {
            AND: [visibleFoodWhere(userId), { id: { in: semanticIds } }],
          },
          include: foodItemInclude(userId),
        });
        const byId = new Map(semanticFoods.map((food) => [food.id, food]));
        for (const id of semanticIds) {
          const foodItem = byId.get(id);
          if (foodItem === undefined || seen.has(id)) continue;
          const serialized = serializeFoodItem(foodItem);
          appendUniqueCandidate({
            candidates,
            seen,
            candidate: foodItemCandidate({
              foodItem: serialized,
              matchReason: candidateMatchReason({
                sourceType: foodItem.sourceType,
                sourceProvider: serialized.sourceProvider,
                hasBarcode: foodItem.barcodes.length > 0,
                isSaved: serialized.isSaved,
                isRecent: foodItem.foodLogs.length > 0,
              }),
              rank: candidates.length + 1,
              retrievalEvidence: {
                lexical: false,
                fuzzyDistance: null,
                semanticScore:
                  matches.find((match) => match.foodItemId === id)?.score ??
                  null,
              },
            }),
          });
        }
      } catch {
        // Semantic retrieval is derived and optional; lexical/local search remains usable.
      }
    }

    if (!needsAdditionalCoverage(normalizedQuery, candidates, input.limit)) {
      candidates = rankParseCandidates(normalizedQuery, candidates);
      sendSuccess(response, { candidates: candidates.slice(0, input.limit) });
      return;
    }

    const usdaConfig = usdaFdcConfig();
    try {
      const usdaFoods = await enrichUsdaFoods({
        query: externalSearchQuery(normalizedQuery),
        config: usdaConfig,
        rateLimitKey: createRequestRateLimitKey({
          userId,
          networkIdentifier: request.ip,
          scope: 'food-search',
        }),
        policy: USDA_ENRICHMENT_POLICIES.normalSearch,
        isEnough: (foods) =>
          foods.filter(
            (food) => food.calories !== null && food.protein !== null,
          ).length >= input.limit,
      });

      for (const food of usdaFoods) {
        const externalId = `usda_fdc:${food.sourceId}`;
        if (seen.has(externalId)) continue;
        seen.add(externalId);
        candidates.push(usdaExternalCandidate(food, candidates.length + 1));
      }
    } catch {
      // USDA lookup is an enrichment path. Local food search must keep working.
    }

    candidates = rankParseCandidates(normalizedQuery, candidates);

    sendSuccess(response, { candidates: candidates.slice(0, input.limit) });
  },
);

foodItemsRouter.post(
  '/from-external-candidate',
  validateBody(foodItemExternalCandidateInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodItemExternalCandidateInput>(response);
    const foodItem = await withExternalFoodMaterializationLock({
      sourceProvider: input.sourceProvider,
      sourceId: input.sourceId,
      operation: () =>
        prisma.$transaction(async (transaction) => {
          const persisted = await findOrCreateExternalFoodItem({
            sourceProvider: input.sourceProvider,
            sourceId: input.sourceId,
            config: usdaFdcConfig(),
            transaction,
          });
          return transaction.foodItem.findUniqueOrThrow({
            where: { id: persisted.id },
            include: foodItemInclude(userId),
          });
        }),
    });
    sendSuccess(response, serializeFoodItem(foodItem));
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
    const regionCandidates = barcodeRegionCandidates(regionCode);
    const candidates = barcodeCandidates([barcode]);
    const foodItem = await lookupLocalBarcodeFoodItem({
      barcodes: candidates,
      regionCandidates,
      userId,
    });

    if (foodItem === null) {
      throw notFoundError('Food barcode');
    }

    sendSuccess(response, serializeFoodItem(foodItem));
  },
);

foodItemsRouter.post(
  '/barcode/lookup',
  validateBody(foodBarcodeLookupInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedBody<FoodBarcodeLookupInput>(response);
    const candidates = barcodeCandidates([
      input.barcode,
      ...(input.barcodeCandidates ?? []),
    ]);

    if (candidates.length === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Barcode must be a supported retail barcode.',
        { publicMessageKey: 'barcode_invalid' },
      );
    }

    const regionCandidates = barcodeRegionCandidates(input.regionCode);
    const cacheRegionCode = regionCandidates[0] ?? 'GLOBAL';
    const localFoodItem = await lookupLocalBarcodeFoodItem({
      barcodes: candidates,
      regionCandidates,
      userId,
    });

    if (localFoodItem !== null) {
      sendSuccess(response, serializeFoodItem(localFoodItem));
      return;
    }

    const openFoodFactsResult =
      await fetchFirstOpenFoodFactsProduct(candidates);
    if (openFoodFactsResult === null) {
      throw notFoundError('Food barcode');
    }
    const barcodes = cacheBarcodeCandidates({
      food: openFoodFactsResult.food,
      lookupCandidates: candidates,
      matchedBarcode: openFoodFactsResult.barcode,
      regionCode: cacheRegionCode,
    });
    const primaryBarcode = barcodes[0];

    if (primaryBarcode === undefined) {
      throw notFoundError('Food barcode');
    }

    try {
      const foodItem = await prisma.$transaction(async (transaction) => {
        const createdFoodItem = await transaction.foodItem.create({
          data: {
            ...openFoodFactsData(openFoodFactsResult.food),
            barcodes: { create: primaryBarcode },
          },
        });

        if (barcodes.length > 1) {
          await transaction.foodBarcode.createMany({
            data: barcodes.slice(1).map((barcode) => ({
              ...barcode,
              foodItemId: createdFoodItem.id,
            })),
            skipDuplicates: true,
          });
        }

        return transaction.foodItem.findUniqueOrThrow({
          where: { id: createdFoodItem.id },
          include: foodItemInclude(userId),
        });
      });

      sendSuccess(response, serializeFoodItem(foodItem));
      return;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }

    const racedFoodItem = await lookupLocalBarcodeFoodItem({
      barcodes: candidates,
      regionCandidates,
      userId,
    });

    if (racedFoodItem === null) {
      throw notFoundError('Food barcode');
    }

    sendSuccess(response, serializeFoodItem(racedFoodItem));
  },
);

function libraryFoodItem(
  foodItem: Awaited<ReturnType<typeof visibleFoodItem>>,
  lastUsedAt: Date | null = null,
) {
  if (foodItem === null) return null;
  return {
    ...serializeFoodItem(foodItem),
    archivedAt: foodItem.archivedAt?.toISOString() ?? null,
    lastUsedAt: lastUsedAt?.toISOString() ?? null,
  };
}

function defaultServingError() {
  return new AppError(
    422,
    'SERVING_NEEDS_REVIEW',
    'This serving needs review before it can be used as a default.',
  );
}

async function validateDefaultServing(
  foodItem: NonNullable<Awaited<ReturnType<typeof visibleFoodItem>>>,
  input: DefaultServingInput,
) {
  if (
    foodItem.servingQuantity === null ||
    foodItem.servingUnit === null ||
    foodItem.calories === null ||
    foodItem.protein === null
  ) {
    throw defaultServingError();
  }
  const result = calculateAuthoritativeServing({
    basis: {
      quantity: foodItem.servingQuantity.toNumber(),
      unit: foodItem.servingUnit,
      displayText: null,
      equivalentWeightGrams: foodItem.servingWeightGrams?.toNumber() ?? null,
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
      quantity: input.quantity,
      unit: input.unit,
      ...(input.servingOptionId === undefined
        ? {}
        : { servingOptionId: input.servingOptionId }),
    },
    provenance: {
      basisOrigin: 'food_item',
      foodItemId: foodItem.id,
      sourceType: foodItem.sourceType,
      sourceProvider: foodItem.sourceProvider,
      sourceId: foodItem.sourceId,
      trustLevel: 'trusted',
    },
  });
  if (!result.ok) throw defaultServingError();
}

foodItemsRouter.get(
  '/library',
  validateQuery(foodLibraryQuerySchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const input = validatedQuery<FoodLibraryQuery>(response);
    const query =
      input.query === undefined ? undefined : normalizeText(input.query);
    const active = { archivedAt: null };
    const baseSearch = query === undefined ? {} : searchTextWhere(query);
    let foodItems: Array<{
      item: Awaited<ReturnType<typeof visibleFoodItem>>;
      lastUsedAt: Date | null;
    }> = [];
    if (input.section === 'recent') {
      const logs = await prisma.foodLog.findMany({
        where: {
          userId,
          foodItemId: { not: null },
          foodItem: { is: { ...visibleFoodWhere(userId), ...baseSearch } },
        },
        distinct: ['foodItemId'],
        orderBy: [{ foodItemId: 'asc' }, { loggedAt: 'desc' }],
        select: { foodItemId: true, loggedAt: true },
        take: input.limit,
      });
      foodItems = await Promise.all(
        logs.map(async (log) => ({
          item: await visibleFoodItem(log.foodItemId!, userId),
          lastUsedAt: log.loggedAt,
        })),
      );
    } else {
      const where: Prisma.FoodItemWhereInput =
        input.section === 'saved'
          ? {
              ...visibleFoodWhere(userId),
              ...baseSearch,
              savedByUsers: { some: { userId } },
            }
          : input.section === 'my_foods'
            ? {
                userId,
                sourceType: 'user_custom',
                sourceProvider: 'manual',
                ...active,
                ...baseSearch,
              }
            : {
                userId,
                sourceType: 'user_custom',
                sourceProvider: 'manual',
                archivedAt: { not: null },
                ...baseSearch,
              };
      const records = await prisma.foodItem.findMany({
        where,
        include: foodItemInclude(userId),
        orderBy:
          input.section === 'archived'
            ? [{ archivedAt: 'desc' }, { name: 'asc' }]
            : [{ updatedAt: 'desc' }, { name: 'asc' }],
        take: input.limit,
      });
      foodItems = records.map((item) => ({ item, lastUsedAt: null }));
    }
    const items = foodItems
      .map(({ item, lastUsedAt }) => libraryFoodItem(item, lastUsedAt))
      .filter((item): item is NonNullable<typeof item> => item !== null);
    items.sort((left, right) =>
      input.sort === 'name'
        ? left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
        : (right.lastUsedAt ?? right.updatedAt).localeCompare(
            left.lastUsedAt ?? left.updatedAt,
          ) || left.name.localeCompare(right.name),
    );
    sendSuccess(response, { section: input.section, foodItems: items });
  },
);

foodItemsRouter.get(
  '/library/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const item = await prisma.foodItem.findFirst({
      where: {
        id,
        OR: [
          { archivedAt: null, OR: [{ userId }, { userId: null }] },
          { userId, sourceType: 'user_custom', sourceProvider: 'manual' },
        ],
      },
      include: foodItemInclude(userId),
    });
    if (item === null) throw notFoundError('Food item');
    sendSuccess(response, libraryFoodItem(item));
  },
);

foodItemsRouter.put(
  '/:id/default-serving',
  validateParams(idParamsSchema),
  validateBody(foodItemDefaultServingInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const foodItem = await visibleFoodItem(id, userId);
    if (foodItem === null) throw notFoundError('Food item');
    const input = validatedBody<DefaultServingInput>(response);
    await validateDefaultServing(foodItem, input);
    await prisma.foodItemServingPreference.upsert({
      where: { userId_foodItemId: { userId, foodItemId: id } },
      update: {
        defaultServingQuantity: input.quantity,
        defaultServingUnit: input.unit,
        defaultServingOptionId: input.servingOptionId ?? null,
      },
      create: {
        userId,
        foodItemId: id,
        defaultServingQuantity: input.quantity,
        defaultServingUnit: input.unit,
        defaultServingOptionId: input.servingOptionId ?? null,
      },
    });
    sendSuccess(response, {
      foodItemId: id,
      defaultServing: {
        quantity: input.quantity,
        unit: input.unit,
        servingOptionId: input.servingOptionId ?? null,
      },
    });
  },
);

foodItemsRouter.delete(
  '/:id/default-serving',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    if ((await visibleFoodItem(id, userId)) === null)
      throw notFoundError('Food item');
    await prisma.foodItemServingPreference.deleteMany({
      where: { userId, foodItemId: id },
    });
    sendSuccess(response, { foodItemId: id, defaultServing: null });
  },
);

foodItemsRouter.post(
  '/:id/restore',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const item = await prisma.foodItem.findFirst({
      where: {
        id,
        userId,
        sourceType: 'user_custom',
        sourceProvider: 'manual',
        archivedAt: { not: null },
      },
    });
    if (item === null) throw notFoundError('Food item');
    const restored = await prisma.foodItem.update({
      where: { id },
      data: { archivedAt: null },
      include: foodItemInclude(userId),
    });
    sendSuccess(response, serializeFoodItem(restored));
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
        rankingClass: 'user_priority',
        ...normalizedFoodItem(input),
        nutrients: { create: nutrientRows(input.nutrients) },
      },
      include: foodItemInclude(currentUserId(response)),
    });

    sendSuccess(response, serializeFoodItem(foodItem));
  },
);

foodItemsRouter.put(
  '/:id/manual',
  validateParams(idParamsSchema),
  validateBody(manualFoodItemUpdateInputSchema),
  async (_request, response) => {
    const userId = currentUserId(response);
    const { id } = validatedParams<IdParams>(response);
    const existing = await editableManualFoodItem(id, userId);
    if (existing === null) throw notFoundError('Food item');
    const input = validatedBody<ManualFoodItemUpdateInput>(response);
    const merged = {
      ...manualRecordInput(existing),
      ...input,
    } as ManualFoodItemCreateInput;
    const foodItem = await prisma.foodItem.update({
      where: { id },
      data: {
        ...manualFoodItemData(merged),
        ...(input.nutrition === undefined
          ? {}
          : {
              nutrients: {
                deleteMany: {},
                create: manualNutrientRows(merged.nutrition.nutrients),
              },
            }),
      },
      include: foodItemInclude(userId),
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
