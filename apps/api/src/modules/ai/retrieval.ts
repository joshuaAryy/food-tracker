import {
  foodItemServingOptionsSchema,
  parseServingText,
} from '@food-tracker/shared';
import type {
  AiFoodCandidateMatchReason,
  AiFoodParsedItem,
  FoodItem,
} from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { emitServerDiagnostic } from '../../lib/diagnostics.js';
import { prisma } from '../../lib/prisma.js';
import { serializeFoodItem } from '../../lib/serializers.js';
import {
  enrichUsdaFoods,
  defaultWholeItemServingFromOptions,
  USDA_ENRICHMENT_POLICIES,
  usdaFdcConfig,
  type UsdaDetailUnavailableReason,
  type UsdaSearchFood,
} from '../foodItems/usda-fdc.js';
import {
  bestTrustedCandidate,
  externalSearchQuery,
  normalizeText,
  queryVariants,
  rankParseCandidates,
} from '../foodItems/candidate-ranking.js';
import type { ProviderParsedFoodItem } from './provider.js';
import { photoAnalysisDiagnosticDetails } from './photo-diagnostics.js';

function searchTextWhere(value: string): Prisma.FoodItemWhereInput {
  return {
    OR: queryVariants(value).map((variant) => ({
      searchText: { contains: variant },
    })),
  };
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

function candidateReason(
  sourceType: string,
  hasBarcode: boolean,
  sourceProvider?: string | null,
): AiFoodCandidateMatchReason {
  if (sourceType === 'user_custom') return 'custom';
  if (
    sourceProvider === 'cnf' ||
    sourceProvider === 'ciqual' ||
    sourceProvider === 'cofid' ||
    sourceProvider === 'usda_fdc'
  ) {
    return 'reference';
  }
  if (sourceType === 'app_owned') return 'app';
  return hasBarcode ? 'barcode_cached' : 'cached_external';
}

function logUsdaRetrievalDiagnostic(
  category: string,
  details: Record<string, unknown>,
): void {
  emitServerDiagnostic(
    category,
    photoAnalysisDiagnosticDetails(details),
    'ai-food-parse:usda',
  );
}

export async function retrieveParsedFoodItems(input: {
  userId: string;
  rateLimitKey: string;
  parsedItems: ProviderParsedFoodItem[];
}): Promise<AiFoodParsedItem[]> {
  const result: AiFoodParsedItem[] = [];

  for (const [itemIndex, parsedItem] of input.parsedItems.entries()) {
    const normalizedQuery = normalizeText(parsedItem.name);
    const seen = new Set<string>();
    const candidates: AiFoodParsedItem['candidates'] = [];

    const pushCandidate = (
      foodItem: FoodItem,
      matchReason: AiFoodCandidateMatchReason,
    ) => {
      if (seen.has(foodItem.id)) return;
      seen.add(foodItem.id);
      if (foodItem.sourceProvider !== null && foodItem.sourceId !== null) {
        seen.add(`${foodItem.sourceProvider}:${foodItem.sourceId}`);
      }
      candidates.push({
        candidateType: 'food_item',
        foodItem: {
          ...foodItem,
          defaultWholeItemServing: defaultWholeItemServingFromOptions(
            foodItem.servingOptions,
          ),
        },
        externalFood: null,
        rank: candidates.length + 1,
        matchReason,
        confidence: 'low',
        defaultServingMultiplier: 1,
      });
    };

    const recentLogs = await prisma.foodLog.findMany({
      where: {
        userId: input.userId,
        foodItemId: { not: null },
        foodItem: {
          AND: [
            visibleFoodWhere(input.userId),
            searchTextWhere(normalizedQuery),
          ],
        },
      },
      include: {
        foodItem: { include: foodItemInclude(input.userId) },
      },
      orderBy: [{ loggedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    for (const log of recentLogs) {
      if (log.foodItem !== null) {
        pushCandidate(serializeFoodItem(log.foodItem), 'recent');
      }
    }

    const savedFoods = await prisma.foodItem.findMany({
      where: {
        AND: [visibleFoodWhere(input.userId), searchTextWhere(normalizedQuery)],
        savedByUsers: { some: { userId: input.userId } },
      },
      include: foodItemInclude(input.userId),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    for (const foodItem of savedFoods) {
      pushCandidate(serializeFoodItem(foodItem), 'saved');
    }

    const customFoods = await prisma.foodItem.findMany({
      where: {
        userId: input.userId,
        sourceType: 'user_custom',
        archivedAt: null,
        ...searchTextWhere(normalizedQuery),
      },
      include: foodItemInclude(input.userId),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    for (const foodItem of customFoods) {
      pushCandidate(serializeFoodItem(foodItem), 'custom');
    }

    const appFoods = await prisma.foodItem.findMany({
      where: {
        userId: null,
        archivedAt: null,
        sourceType: 'app_owned',
        ...searchTextWhere(normalizedQuery),
      },
      include: foodItemInclude(input.userId),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    for (const foodItem of appFoods) {
      pushCandidate(
        serializeFoodItem(foodItem),
        candidateReason(
          foodItem.sourceType,
          foodItem.barcodes.length > 0,
          foodItem.sourceProvider,
        ),
      );
    }

    const cachedFoods = await prisma.foodItem.findMany({
      where: {
        userId: null,
        archivedAt: null,
        sourceType: 'cached_external',
        ...searchTextWhere(normalizedQuery),
      },
      include: foodItemInclude(input.userId),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    for (const foodItem of cachedFoods) {
      pushCandidate(
        serializeFoodItem(foodItem),
        candidateReason(
          foodItem.sourceType,
          foodItem.barcodes.length > 0,
          foodItem.sourceProvider,
        ),
      );
    }

    if (bestTrustedCandidate(normalizedQuery, candidates) === undefined) {
      const usdaConfig = usdaFdcConfig();
      try {
        const unavailableUsdaFoods: Array<{
          food: UsdaSearchFood;
          reason: UsdaDetailUnavailableReason;
        }> = [];
        const usdaFoods = await enrichUsdaFoods({
          query: externalSearchQuery(normalizedQuery),
          config: usdaConfig,
          rateLimitKey: input.rateLimitKey,
          policy: USDA_ENRICHMENT_POLICIES.aiRetrieval,
          isEnough: (foods) =>
            foods.some(
              (food) => food.calories !== null && food.protein !== null,
            ),
          onDetailUnavailable: (detail) => {
            unavailableUsdaFoods.push(detail);
          },
        });

        for (const food of usdaFoods) {
          const externalId = `usda_fdc:${food.sourceId}`;
          if (seen.has(externalId)) continue;
          seen.add(externalId);

          candidates.push({
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
              servingOptions: foodItemServingOptionsSchema.safeParse(
                food.servingOptions,
              ).success
                ? foodItemServingOptionsSchema.parse(food.servingOptions)
                : null,
              defaultWholeItemServing: defaultWholeItemServingFromOptions(
                foodItemServingOptionsSchema.safeParse(food.servingOptions)
                  .success
                  ? foodItemServingOptionsSchema.parse(food.servingOptions)
                  : null,
              ),
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
            rank: candidates.length + 1,
            matchReason: 'usda_fdc',
            confidence: 'low',
            defaultServingMultiplier: 1,
          });
        }

        for (const { food, reason } of unavailableUsdaFoods) {
          const externalId = `usda_fdc:${food.fdcId}`;
          if (seen.has(externalId)) continue;
          seen.add(externalId);
          candidates.push({
            candidateType: 'external_food',
            foodItem: null,
            externalFood: {
              sourceProvider: 'usda_fdc',
              sourceId: String(food.fdcId),
              name: food.description,
              brandName: food.brandName ?? food.brandOwner,
              foodType:
                food.dataType === 'Branded' ||
                food.brandName !== null ||
                food.brandOwner !== null
                  ? 'branded'
                  : 'generic',
              servingBasisText: `USDA nutrition details unavailable (${reason})`,
              servingQuantity: null,
              servingUnit: null,
              servingWeightGrams: null,
              servingOptions: null,
              defaultWholeItemServing: null,
              calories: null,
              protein: null,
              carbs: null,
              fat: null,
              fiber: null,
              sugar: null,
              sodium: null,
              nutrients: {},
            },
            rank: candidates.length + 1,
            matchReason: 'usda_fdc',
            confidence: 'low',
            defaultServingMultiplier: 1,
          });
        }
      } catch (error) {
        logUsdaRetrievalDiagnostic('non_fatal_lookup_failure', {
          errorCategory:
            error instanceof Error && error.name === 'AbortError'
              ? 'timeout'
              : 'provider_failure',
        });
      }
    }

    const rankedCandidates = rankParseCandidates(normalizedQuery, candidates);
    const selectedCandidate = bestTrustedCandidate(
      normalizedQuery,
      rankedCandidates,
    );

    result.push({
      id: `item-${itemIndex + 1}`,
      parsedName: normalizedQuery,
      quantityText: parsedItem.quantityText,
      servingText: parsedItem.servingText,
      servingSuggestion: parseServingText({
        quantityText: parsedItem.quantityText,
        servingText: parsedItem.servingText,
      }),
      reviewStatus:
        candidates.length === 0
          ? 'unmatched'
          : selectedCandidate === undefined
            ? 'needs_review'
            : selectedCandidate.candidateType === 'external_food'
              ? 'needs_review'
              : 'matched',
      loggable: selectedCandidate !== undefined,
      selectedCandidateId:
        selectedCandidate === undefined
          ? null
          : selectedCandidate.candidateType === 'food_item'
            ? selectedCandidate.foodItem.id
            : `usda_fdc:${selectedCandidate.externalFood.sourceId}`,
      candidates: rankedCandidates,
    });
  }

  return result;
}
