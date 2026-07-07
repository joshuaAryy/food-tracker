import type {
  AiFoodCandidateConfidence,
  AiFoodCandidateMatchReason,
  AiFoodParsedItem,
  FoodItem,
} from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { serializeFoodItem } from '../../lib/serializers.js';
import {
  fetchUsdaFood,
  searchUsdaFoods,
  usdaFdcConfig,
} from '../foodItems/usda-fdc.js';
import type { ProviderParsedFoodItem } from './provider.js';

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
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

function confidenceFor(
  foodItem: FoodItem,
  normalizedQuery: string,
): AiFoodCandidateConfidence {
  const normalizedName = normalizeText(foodItem.name);
  if (normalizedName === normalizedQuery) return 'high';
  if (
    normalizedName.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedName)
  ) {
    return 'medium';
  }
  return 'low';
}

function candidateReason(
  sourceType: string,
  hasBarcode: boolean,
): AiFoodCandidateMatchReason {
  if (sourceType === 'user_custom') return 'custom';
  if (sourceType === 'app_owned') return 'app';
  return hasBarcode ? 'barcode_cached' : 'cached_external';
}

function diagnosticText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"',}]+/gi, (match) => {
      try {
        const url = new URL(match);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[invalid-url]';
      }
    })
    .replace(/api[_-]?key=([^&"'\s]+)/gi, 'api_key=[redacted]')
    .replace(
      /(api[_-]?key|key|token|authorization)["':=\s]+[^"',\s}]+/gi,
      '$1=[redacted]',
    )
    .slice(0, 500);
}

function logUsdaRetrievalDiagnostic(
  category: string,
  details: Record<string, unknown>,
): void {
  console.warn('[ai-food-parse:usda]', { category, ...details });
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
      candidates.push({
        candidateType: 'food_item',
        foodItem,
        externalFood: null,
        rank: candidates.length + 1,
        matchReason,
        confidence: confidenceFor(foodItem, normalizedQuery),
        defaultServingMultiplier: 1,
      });
    };

    const recentLogs = await prisma.foodLog.findMany({
      where: {
        userId: input.userId,
        foodItemId: { not: null },
        foodItem: {
          ...visibleFoodWhere(input.userId),
          searchText: { contains: normalizedQuery },
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
        ...visibleFoodWhere(input.userId),
        searchText: { contains: normalizedQuery },
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
        searchText: { contains: normalizedQuery },
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
        searchText: { contains: normalizedQuery },
      },
      include: foodItemInclude(input.userId),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    for (const foodItem of appFoods) {
      pushCandidate(
        serializeFoodItem(foodItem),
        candidateReason(foodItem.sourceType, foodItem.barcodes.length > 0),
      );
    }

    const cachedFoods = await prisma.foodItem.findMany({
      where: {
        userId: null,
        archivedAt: null,
        sourceType: 'cached_external',
        searchText: { contains: normalizedQuery },
      },
      include: foodItemInclude(input.userId),
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    for (const foodItem of cachedFoods) {
      pushCandidate(
        serializeFoodItem(foodItem),
        candidateReason(foodItem.sourceType, foodItem.barcodes.length > 0),
      );
    }

    let selectedCandidate = candidates.find(
      (candidate) =>
        candidate.candidateType === 'food_item' &&
        candidate.foodItem.calories !== null &&
        candidate.foodItem.protein !== null,
    );

    if (selectedCandidate === undefined) {
      const usdaConfig = usdaFdcConfig();
      try {
        const usdaMatches = await searchUsdaFoods({
          query: normalizedQuery,
          config: usdaConfig,
          rateLimitKey: input.rateLimitKey,
        });

        for (const usdaMatch of usdaMatches) {
          const food = await fetchUsdaFood({
            sourceId: String(usdaMatch.fdcId),
            config: usdaConfig,
          });

          if (food === null) continue;

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
            confidence: confidenceFor(
              {
                id: externalId,
                name: food.name,
                brandName: food.brandName,
                sourceType: 'cached_external',
                foodType: food.foodType,
                sourceProvider: 'usda_fdc',
                sourceId: food.sourceId,
                sourceUpdatedAt: food.sourceUpdatedAt?.toISOString() ?? null,
                isSaved: false,
                servingQuantity: food.servingQuantity,
                servingUnit: food.servingUnit,
                servingWeightGrams: food.servingWeightGrams,
                calories: food.calories,
                protein: food.protein,
                carbs: food.carbs,
                fat: food.fat,
                fiber: food.fiber,
                sugar: food.sugar,
                sodium: food.sodium,
                additionalNutrients: null,
                nutrients: {},
                barcodes: [],
                createdAt: new Date(0).toISOString(),
                updatedAt: new Date(0).toISOString(),
              },
              normalizedQuery,
            ),
            defaultServingMultiplier: 1,
          });
        }
      } catch (error) {
        logUsdaRetrievalDiagnostic('non_fatal_lookup_failure', {
          query: normalizedQuery,
          message:
            error instanceof Error ? diagnosticText(error.message) : 'unknown',
        });
      }

      selectedCandidate = candidates.find(
        (candidate) =>
          candidate.candidateType === 'external_food' &&
          candidate.externalFood.calories !== null &&
          candidate.externalFood.protein !== null,
      );
    }

    result.push({
      id: `item-${itemIndex + 1}`,
      parsedName: normalizedQuery,
      quantityText: parsedItem.quantityText,
      servingText: parsedItem.servingText,
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
      candidates,
    });
  }

  return result;
}
