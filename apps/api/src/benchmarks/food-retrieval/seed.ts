import type { PrismaClient } from '@prisma/client';
import { normalizeFoodIdentityText } from '../../modules/foodItems/text-normalization.js';
import { FOOD_RETRIEVAL_CORPUS } from './corpus.js';
import type { FoodRetrievalBenchmarkQuery } from './types.js';

export interface BenchmarkSeedRow {
  queryId: string;
  query: string;
  name: string;
  provider: 'usda_fdc' | 'open_food_facts';
  sourceId: string;
  userId: null;
  sourceType: 'cached_external';
  foodType: 'generic' | 'branded';
  sourceAliases: readonly string[];
  normalizedName: string;
  searchText: string;
}

export function benchmarkSeedRows(
  corpus: readonly FoodRetrievalBenchmarkQuery[] = FOOD_RETRIEVAL_CORPUS,
): BenchmarkSeedRow[] {
  return corpus.map((query) => {
    const aliases = query.gold.aliases ?? [];
    const name = query.gold.canonicalName;
    const provider =
      query.gold.expectedProvider === 'open_food_facts'
        ? 'open_food_facts'
        : 'usda_fdc';
    const searchText = normalizeFoodIdentityText([name, ...aliases].join(' '));
    return {
      queryId: query.id,
      query: query.query,
      name,
      provider,
      sourceId: `benchmark-${query.id}`,
      userId: null,
      sourceType: 'cached_external',
      foodType: query.queryClass === 'branded' ? 'branded' : 'generic',
      sourceAliases: aliases,
      normalizedName: normalizeFoodIdentityText(name),
      searchText,
    };
  });
}

export async function seedBenchmarkCatalog(
  prisma: PrismaClient,
  corpus: readonly FoodRetrievalBenchmarkQuery[] = FOOD_RETRIEVAL_CORPUS,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const row of benchmarkSeedRows(corpus)) {
    const existing = await prisma.foodItem.findFirst({
      where: { sourceProvider: row.provider, sourceId: row.sourceId },
      orderBy: [{ createdAt: 'asc' }],
    });
    const data = {
      userId: row.userId,
      name: row.name,
      brandName: null,
      foodType: row.foodType,
      normalizedName: row.normalizedName,
      searchText: row.searchText,
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      calories: 100,
      protein: 10,
      carbs: 20,
      fat: 5,
      sodium: 50,
      sourceType: row.sourceType,
      sourceProvider: row.provider,
      sourceId: row.sourceId,
      sourceAliases: row.sourceAliases,
      rankingClass: 'reference' as const,
      datasetRelease: null,
      sourceRecordHash: `benchmark-${row.queryId}`,
      archivedAt: null,
    };
    if (existing === null) {
      await prisma.foodItem.create({ data });
      created += 1;
    } else {
      await prisma.foodItem.update({ where: { id: existing.id }, data });
      updated += 1;
    }
  }
  return { created, updated };
}
