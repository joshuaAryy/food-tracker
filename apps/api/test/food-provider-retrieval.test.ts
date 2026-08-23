import { describe, expect, it } from 'vitest';
import { parseCnfCsv } from '../src/modules/foodItems/providers/cnf.js';
import { countImportRows } from '../src/modules/foodItems/providers/importer.js';
import {
  dedupeAliases,
  normalizeIdentityText,
} from '../src/modules/foodItems/providers/normalized.js';
import {
  acceptFuzzyCandidate,
  FUZZY_RETRIEVAL_VERSION,
  fuzzyCandidateQueries,
} from '../src/modules/foodItems/retrieval/fuzzy.js';
import {
  decideRetrievalPolicy,
  unionGeneratedCandidates,
} from '../src/modules/foodItems/retrieval/types.js';

describe('provider normalization', () => {
  it('preserves unknown CNF values instead of converting them to zero', () => {
    const foods = parseCnfCsv({
      foods: 'FoodID,FoodName,FoodGroup\n1,Egg,Eggs\n',
      nutrients: 'NutrientID,NutrientName\n1,Protein\n2,Energy\n',
      foodNutrients: 'FoodID,NutrientID,Amount,Unit\n1,1,N,g\n1,2,143,kcal\n',
    });
    expect(foods).toHaveLength(1);
    expect(foods[0]?.nutrients).toHaveLength(1);
    expect(foods[0]?.nutrients[0]?.key).toBe('calories');
  });

  it('normalizes aliases deterministically while retaining display spelling', () => {
    expect(normalizeIdentityText('Œuf de poule')).toBe('oeuf de poule');
    expect(dedupeAliases('Crème', ['crème', 'Creme', 'Pâté'])).toEqual([
      'Pâté',
    ]);
  });

  it('counts deterministic duplicate and rejected import rows', () => {
    const row = {
      provider: 'cnf' as const,
      release: '2026',
      sourceId: '1',
      name: 'Egg',
      authoritativeAliases: [],
      brandName: null,
      foodType: 'generic' as const,
      category: null,
      preparation: null,
      region: 'CA',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      nutrients: [],
      sourceRecordHash: 'x',
    };
    expect(countImportRows([row, row])).toMatchObject({
      imported: 1,
      skipped: 1,
      rejected: 0,
    });
  });
});

describe('hybrid retrieval policy', () => {
  it('keeps normal search coverage-aware and AI safe-local short-circuiting', () => {
    expect(
      decideRetrievalPolicy({
        mode: 'normal_search',
        trustedLocalCandidate: true,
        usefulTopKCount: 1,
        requestedLimit: 5,
      }).fetchSemantic,
    ).toBe(true);
    expect(
      decideRetrievalPolicy({
        mode: 'ai',
        trustedLocalCandidate: true,
        usefulTopKCount: 1,
        requestedLimit: 5,
      }).fetchSemantic,
    ).toBe(false);
  });

  it('deduplicates candidates by authoritative FoodItem identity', () => {
    const candidate = {
      candidateType: 'food_item' as const,
      foodItem: { id: 'food-1' },
    } as never;
    const generated = {
      candidate,
      identity: { canonicalName: 'Egg', authoritativeAliases: [] },
      provenance: {
        rankingSource: 'reference' as const,
        sourceProvider: 'cnf' as const,
        sourceRegion: 'CA',
      },
      evidence: { lexical: true, fuzzyDistance: null, semanticScore: null },
    };
    expect(unionGeneratedCandidates([[generated], [generated]])).toHaveLength(
      1,
    );
  });

  it('keeps fuzzy thresholds explicit and versioned', () => {
    expect(FUZZY_RETRIEVAL_VERSION).toBe('trgm-v1');
    expect(
      acceptFuzzyCandidate({ id: 'x', distance: 0.2, kind: 'whole_string' }),
    ).toBe(true);
    expect(
      acceptFuzzyCandidate({ id: 'x', distance: 0.9, kind: 'whole_string' }),
    ).toBe(false);
    expect(fuzzyCandidateQueries('greek yogrt', 10)).toHaveLength(2);
  });
});
