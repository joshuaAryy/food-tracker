import type {
  AiFoodCandidateConfidence,
  AiFoodCandidateMatchReason,
  AiFoodParsedItem,
  FoodItem,
} from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { serializeFoodItem } from '../../lib/serializers.js';
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

export async function retrieveParsedFoodItems(input: {
  userId: string;
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
        foodItem,
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

    const selectedCandidate = candidates.find(
      (candidate) =>
        candidate.foodItem.calories !== null &&
        candidate.foodItem.protein !== null,
    );

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
            : 'matched',
      loggable: selectedCandidate !== undefined,
      selectedCandidateId: selectedCandidate?.foodItem.id ?? null,
      candidates,
    });
  }

  return result;
}
