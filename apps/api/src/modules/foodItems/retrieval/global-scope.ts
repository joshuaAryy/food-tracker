import { Prisma, type FoodSourceProvider } from '@prisma/client';
import {
  searchDocumentForFood,
  type FoodSearchDocument,
} from './index-lifecycle.js';

const EXCLUDED_CACHED_PROVIDERS = ['open_food_facts', 'usda_fdc'] as const;

export interface GlobalSearchFoodRecord {
  id: string;
  name: string;
  brandName: string | null;
  sourceAliases: unknown;
  searchText: string;
  sourceProvider: string | null;
  sourceRegion: string | null;
  sourceType: string;
  rankingClass: string;
  datasetRelease: string | null;
  barcodes: readonly unknown[];
  userId: string | null;
  archivedAt: Date | null;
}

export function globalSearchFoodWhere(): Prisma.FoodItemWhereInput {
  return {
    userId: null,
    archivedAt: null,
    sourceType: 'app_owned',
    rankingClass: { in: ['reference', 'app_curated'] },
    OR: [
      { sourceProvider: null },
      {
        sourceProvider: {
          notIn: [...EXCLUDED_CACHED_PROVIDERS] as FoodSourceProvider[],
        },
      },
    ],
  };
}

export function isEligibleGlobalSearchFood(
  food: GlobalSearchFoodRecord,
): boolean {
  return (
    food.userId === null &&
    food.archivedAt === null &&
    food.sourceType === 'app_owned' &&
    (food.rankingClass === 'reference' ||
      food.rankingClass === 'app_curated') &&
    (food.sourceProvider === null ||
      !EXCLUDED_CACHED_PROVIDERS.includes(
        food.sourceProvider as (typeof EXCLUDED_CACHED_PROVIDERS)[number],
      ))
  );
}

export function globalSearchDocumentForFood(
  food: GlobalSearchFoodRecord,
): FoodSearchDocument {
  const aliases = Array.isArray(food.sourceAliases)
    ? food.sourceAliases.filter(
        (alias): alias is string => typeof alias === 'string',
      )
    : [];
  return searchDocumentForFood({
    id: food.id,
    name: food.name,
    aliases,
    searchText: food.searchText,
    brandName: food.brandName,
    category: null,
    preparation: null,
    sourceProvider: food.sourceProvider,
    sourceRegion: food.sourceRegion,
    sourceType: 'app_owned',
    rankingClass: food.rankingClass as 'reference' | 'app_curated',
    datasetRelease: food.datasetRelease,
    hasBarcode: food.barcodes.length > 0,
  });
}

export function buildGlobalSearchDocuments(
  foods: readonly GlobalSearchFoodRecord[],
): FoodSearchDocument[] {
  return foods
    .filter(isEligibleGlobalSearchFood)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(globalSearchDocumentForFood);
}

/** Restricts semantic rehydration to the global catalog represented in Pinecone. */
export function globalSemanticFoodWhere(
  ids: readonly string[],
): Prisma.FoodItemWhereInput {
  return {
    id: { in: [...ids] },
    AND: [globalSearchFoodWhere()],
  };
}
