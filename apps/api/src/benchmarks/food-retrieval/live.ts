import { performance } from 'node:perf_hooks';
import {
  Prisma,
  type FoodSourceProvider,
  type PrismaClient,
} from '@prisma/client';
import type { AiFoodParseCandidate, FoodItem } from '@food-tracker/shared';
import { serializeFoodItem } from '../../lib/serializers.js';
import {
  bestTrustedCandidate,
  rankParseCandidates,
} from '../../modules/foodItems/candidate-ranking.js';
import {
  appendUniqueCandidate,
  candidateMatchReason,
  foodItemCandidate,
} from '../../modules/foodItems/retrieval/candidate-generation.js';
import { retrieveFuzzyFoodItemMatches } from '../../modules/foodItems/retrieval/fuzzy.js';
import {
  createPineconeSemanticClient,
  type SemanticSearchMatch,
} from '../../modules/foodItems/retrieval/pinecone.js';
import { globalSemanticFoodWhere } from '../../modules/foodItems/retrieval/global-scope.js';
import { resolveActiveSemanticNamespace } from '../../modules/foodItems/retrieval/index-lifecycle.js';
import {
  externalSearchQuery,
  normalizeText,
  queryVariants,
} from '../../modules/foodItems/candidate-ranking.js';
import { normalizeFoodIdentityText } from '../../modules/foodItems/text-normalization.js';
import {
  FOOD_RETRIEVAL_BENCHMARK_VERSION,
  type BenchmarkCandidate,
  type BenchmarkEvidence,
  type BenchmarkObservation,
  type FoodRetrievalBenchmarkQuery,
  type BenchmarkRunName,
} from './types.js';

const BULK_REFERENCE_PROVIDERS = ['cnf', 'ciqual', 'cofid'] as const;
const DEFAULT_CANDIDATE_LIMIT = 20;

export type LiveBenchmarkMode = Exclude<BenchmarkRunName, 'legacy'> | 'legacy';

export interface LiveBenchmarkOptions {
  prisma: PrismaClient;
  mode: LiveBenchmarkMode;
  limit?: number;
  region?: string | null;
}

type FoodWithRetrievalRelations = Prisma.FoodItemGetPayload<{
  include: { barcodes: true; nutrients: true };
}>;

function legacyFoodWhere(): Prisma.FoodItemWhereInput {
  return {
    userId: null,
    archivedAt: null,
    OR: [
      { sourceProvider: null },
      {
        sourceProvider: {
          notIn: [...BULK_REFERENCE_PROVIDERS] as FoodSourceProvider[],
        },
      },
    ],
  };
}

function catalogFoodWhere(mode: LiveBenchmarkMode) {
  return mode === 'legacy'
    ? legacyFoodWhere()
    : { userId: null, archivedAt: null };
}

function evidenceForCandidate(
  candidate: AiFoodParseCandidate,
): BenchmarkEvidence {
  const retrievalEvidence = candidate.retrievalEvidence;
  if (
    retrievalEvidence?.semanticScore !== null &&
    retrievalEvidence?.semanticScore !== undefined
  ) {
    return 'semantic';
  }
  if (
    retrievalEvidence?.fuzzyDistance !== null &&
    retrievalEvidence?.fuzzyDistance !== undefined
  ) {
    return 'fuzzy';
  }
  return retrievalEvidence?.lexical === true ? 'exact' : 'none';
}

function benchmarkCandidate(
  candidate: AiFoodParseCandidate,
): BenchmarkCandidate {
  const food =
    candidate.candidateType === 'food_item'
      ? candidate.foodItem
      : candidate.externalFood;
  const trusted =
    candidate.candidateType === 'food_item' && candidate.confidence !== 'low';
  const provider = food.sourceProvider;
  const stableIdentity =
    provider !== null && food.sourceId !== null
      ? `${provider}:${food.sourceId}`
      : normalizeFoodIdentityText(food.name);
  return {
    id: stableIdentity,
    name: food.name,
    provider,
    source: candidate.matchReason,
    trusted,
    evidence: evidenceForCandidate(candidate),
    defaultSelectionSafe: trusted,
    duplicateKey:
      provider !== null && food.sourceId !== null
        ? `${provider}:${food.sourceId}`
        : `${provider ?? 'none'}:${food.name}`,
  };
}

function appendFoodCandidate(input: {
  candidates: AiFoodParseCandidate[];
  seen: Set<string>;
  food: FoodItem;
  evidence: {
    lexical: boolean;
    fuzzyDistance: number | null;
    semanticScore: number | null;
  };
}) {
  appendUniqueCandidate({
    candidates: input.candidates,
    seen: input.seen,
    candidate: foodItemCandidate({
      foodItem: input.food,
      matchReason: candidateMatchReason({
        sourceType: input.food.sourceType,
        sourceProvider: input.food.sourceProvider,
        hasBarcode: input.food.barcodes.length > 0,
      }),
      rank: input.candidates.length + 1,
      retrievalEvidence: input.evidence,
    }),
  });
}

function toFoodItem(food: FoodWithRetrievalRelations): FoodItem {
  return serializeFoodItem({
    ...food,
    barcodes: 'barcodes' in food ? food.barcodes : [],
    nutrients: 'nutrients' in food ? food.nutrients : [],
    savedByUsers: [],
    servingPreferences: [],
  });
}

async function fetchFoods(
  prisma: PrismaClient,
  where: Prisma.FoodItemWhereInput,
  limit: number,
) {
  return prisma.foodItem.findMany({
    where,
    include: { barcodes: true, nutrients: true },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
}

async function appendSemanticCandidates(input: {
  prisma: PrismaClient;
  query: string;
  candidates: AiFoodParseCandidate[];
  seen: Set<string>;
  limit: number;
}): Promise<boolean> {
  const apiKey = process.env.PINECONE_API_KEY;
  const host = process.env.PINECONE_INDEX_HOST;
  if (!apiKey || !host) return false;
  const client = createPineconeSemanticClient({
    apiKey,
    indexHost: host,
    namespace: await resolveActiveSemanticNamespace({
      prisma: input.prisma,
      fallback: process.env.PINECONE_ACTIVE_NAMESPACE ?? 'food-search-v1',
    }),
    topK: input.limit,
  });
  const matches: SemanticSearchMatch[] = await client.search(
    externalSearchQuery(normalizeText(input.query)),
    350,
  );
  const ids = matches
    .map((match) => match.foodItemId)
    .filter((id) => !input.seen.has(id));
  const foods = await input.prisma.foodItem.findMany({
    where: globalSemanticFoodWhere(ids),
    include: { barcodes: true, nutrients: true },
    take: input.limit,
  });
  const byId = new Map(foods.map((food) => [food.id, food]));
  for (const match of matches) {
    const food = byId.get(match.foodItemId);
    if (!food) continue;
    appendFoodCandidate({
      candidates: input.candidates,
      seen: input.seen,
      food: toFoodItem(food),
      evidence: {
        lexical: false,
        fuzzyDistance: null,
        semanticScore: match.score,
      },
    });
  }
  return true;
}

export async function retrieveLiveBenchmarkObservation(
  input: LiveBenchmarkOptions & { query: FoodRetrievalBenchmarkQuery },
): Promise<BenchmarkObservation> {
  const startedAt = performance.now();
  const limit = Math.max(
    5,
    Math.min(input.limit ?? DEFAULT_CANDIDATE_LIMIT, 100),
  );
  const candidates: AiFoodParseCandidate[] = [];
  const seen = new Set<string>();
  const normalizedQuery = normalizeText(input.query.query);
  const where = catalogFoodWhere(input.mode);
  const variants = queryVariants(normalizedQuery);
  const lexicalFoods = await fetchFoods(
    input.prisma,
    {
      AND: [
        where,
        {
          OR: variants.map((variant) => ({
            searchText: { contains: variant },
          })),
        },
      ],
    },
    limit,
  );
  for (const food of lexicalFoods) {
    appendFoodCandidate({
      candidates,
      seen,
      food: toFoodItem(food),
      evidence: { lexical: true, fuzzyDistance: null, semanticScore: null },
    });
  }

  if (/^\d{8,14}$/.test(normalizedQuery)) {
    const barcodeFoods = await input.prisma.foodItem.findMany({
      where: {
        userId: null,
        archivedAt: null,
        barcodes: { some: { barcode: normalizedQuery } },
      },
      include: { barcodes: true, nutrients: true },
      take: limit,
    });
    for (const food of barcodeFoods) {
      appendFoodCandidate({
        candidates,
        seen,
        food: toFoodItem(food),
        evidence: { lexical: true, fuzzyDistance: null, semanticScore: null },
      });
    }
  }

  if (input.mode === 'fuzzy' || input.mode === 'full_hybrid') {
    const fuzzyMatches = await retrieveFuzzyFoodItemMatches({
      prisma: input.prisma,
      query: normalizedQuery,
      limit,
    });
    const fuzzyIds = fuzzyMatches.map((match) => match.id);
    const fuzzyFoods = await input.prisma.foodItem.findMany({
      where: { AND: [where, { id: { in: fuzzyIds } }] },
      include: { barcodes: true, nutrients: true },
    });
    const byId = new Map(fuzzyFoods.map((food) => [food.id, food]));
    for (const match of fuzzyMatches) {
      const food = byId.get(match.id);
      if (!food) continue;
      appendFoodCandidate({
        candidates,
        seen,
        food: toFoodItem(food),
        evidence: {
          lexical: false,
          fuzzyDistance: match.distance,
          semanticScore: null,
        },
      });
    }
  }

  let pineconeCalls = 0;
  if (input.mode === 'semantic' || input.mode === 'full_hybrid') {
    pineconeCalls = (await appendSemanticCandidates({
      prisma: input.prisma,
      query: normalizedQuery,
      candidates,
      seen,
      limit,
    }))
      ? 1
      : 0;
  }

  const ranked = rankParseCandidates(
    normalizedQuery,
    candidates,
    input.region === undefined ? {} : { region: input.region },
  );
  const selected = bestTrustedCandidate(normalizedQuery, ranked);
  const selectedId =
    selected === undefined ? null : benchmarkCandidate(selected).id;
  return {
    queryId: input.query.id,
    candidates: ranked.slice(0, limit).map(benchmarkCandidate),
    selectedCandidateId: selectedId,
    latencyMs: performance.now() - startedAt,
    externalCallCount: pineconeCalls,
    pineconeCallCount: pineconeCalls,
    bulkProviderCallCount: 0,
    historicalSnapshotMutated: false,
    privateVectorCount: 0,
  };
}

export const LIVE_BENCHMARK_VERSION = FOOD_RETRIEVAL_BENCHMARK_VERSION;
