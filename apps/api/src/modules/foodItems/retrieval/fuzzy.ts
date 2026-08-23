import { Prisma } from '@prisma/client';
import { normalizeText } from '../candidate-ranking.js';

export const FUZZY_RETRIEVAL_VERSION = 'trgm-v1';
export const FUZZY_THRESHOLDS = {
  wholeStringDistance: 0.58,
  strictWordDistance: 0.64,
} as const;

export interface FuzzyCandidateRow {
  id: string;
  distance: number;
  kind: 'whole_string' | 'strict_word';
}

export function fuzzyCandidateQueries(
  query: string,
  limit: number,
): Prisma.Sql[] {
  const normalized = normalizeText(query);
  return [
    Prisma.sql`SELECT id, searchText <-> ${normalized} AS distance, 'whole_string' AS kind
      FROM "FoodItem"
      WHERE "archivedAt" IS NULL AND "userId" IS NULL
      ORDER BY searchText <-> ${normalized}
      LIMIT ${Math.max(1, Math.min(limit, 100))}`,
    Prisma.sql`SELECT id, searchText <<-> ${normalized} AS distance, 'strict_word' AS kind
      FROM "FoodItem"
      WHERE "archivedAt" IS NULL AND "userId" IS NULL
      ORDER BY searchText <<-> ${normalized}
      LIMIT ${Math.max(1, Math.min(limit, 100))}`,
  ];
}

export function acceptFuzzyCandidate(row: FuzzyCandidateRow): boolean {
  const threshold =
    row.kind === 'whole_string'
      ? FUZZY_THRESHOLDS.wholeStringDistance
      : FUZZY_THRESHOLDS.strictWordDistance;
  return row.distance <= threshold;
}

export async function retrieveFuzzyFoodItemIds(input: {
  prisma: { $queryRaw<T>(query: Prisma.Sql): Promise<T> };
  query: string;
  limit: number;
}): Promise<string[]> {
  const rows = (
    await Promise.all(
      fuzzyCandidateQueries(input.query, input.limit).map((query) =>
        input.prisma.$queryRaw<FuzzyCandidateRow[]>(query),
      ),
    )
  ).flat();
  const seen = new Set<string>();
  return rows
    .filter(acceptFuzzyCandidate)
    .sort((left, right) => left.distance - right.distance)
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .slice(0, Math.max(1, Math.min(input.limit, 100)))
    .map((row) => row.id);
}
