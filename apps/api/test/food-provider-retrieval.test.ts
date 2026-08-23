import { describe, expect, it } from 'vitest';
import type { FoodItem } from '@food-tracker/shared';
import { parseCnfCsv } from '../src/modules/foodItems/providers/cnf.js';
import { parseCiqual } from '../src/modules/foodItems/providers/ciqual.js';
import { parseCofid } from '../src/modules/foodItems/providers/cofid.js';
import { mapProviderNutrient } from '../src/modules/foodItems/providers/nutrient-mapping.js';
import ExcelJS from 'exceljs';
import {
  countImportRows,
  persistProviderFoods,
} from '../src/modules/foodItems/providers/importer.js';
import {
  dedupeAliases,
  normalizeIdentityText,
  providerSearchText,
} from '../src/modules/foodItems/providers/normalized.js';
import {
  boundedSemanticSearch,
  parseSemanticSearchResponse,
  semanticIndexVersionName,
  semanticModelVersion,
} from '../src/modules/foodItems/retrieval/pinecone.js';
import {
  acceptFuzzyCandidate,
  FUZZY_RETRIEVAL_VERSION,
  fuzzyCandidateQueries,
} from '../src/modules/foodItems/retrieval/fuzzy.js';
import {
  decideRetrievalPolicy,
  unionGeneratedCandidates,
} from '../src/modules/foodItems/retrieval/types.js';
import {
  appendUniqueCandidate,
  candidateMatchReason,
  foodItemCandidate,
} from '../src/modules/foodItems/retrieval/candidate-generation.js';
import {
  buildIndexVersionRecord,
  searchDocumentForFood,
  semanticIndexVersion,
  staleSearchDocumentIds,
  versionedNamespace,
} from '../src/modules/foodItems/retrieval/index-lifecycle.js';
import {
  FOOD_DATASET_MANIFESTS,
  manifestFor,
} from '../src/modules/foodItems/providers/manifest.js';

describe('provider normalization', () => {
  it('pins exactly the three approved official datasets', () => {
    expect(FOOD_DATASET_MANIFESTS.map((entry) => entry.provider)).toEqual([
      'cnf',
      'ciqual',
      'cofid',
    ]);
    expect(manifestFor('ciqual', '2025').artifactSha256).toHaveLength(64);
  });
  it('preserves unknown CNF values instead of converting them to zero', () => {
    const foods = parseCnfCsv({
      foods: 'FoodID,FoodName,FoodGroup\n1,Egg,Eggs\n',
      nutrients: 'NutrientID,NutrientName\n1,Protein\n2,Energy\n',
      foodNutrients: 'FoodID,NutrientID,Amount,Unit\n1,1,N,g\n1,2,143,kcal\n',
      measures: 'Food_Code,Measure_Code,Measure_Weight_Conversion\n1,1,52.5\n',
      measureNames:
        'Measure_Code,Measure_Description_and_Unit_EN\n1,1 large egg\n',
    });
    expect(foods).toHaveLength(1);
    expect(foods[0]?.nutrients).toHaveLength(1);
    expect(foods[0]?.nutrients[0]?.key).toBe('calories');
    expect(foods[0]?.servingWeightGrams).toBe(52.5);
    expect(foods[0]?.servingUnit).toBe('1 large egg');
  });

  it('handles official CNF 2026 column names without guessing ambiguous nutrients', () => {
    const foods = parseCnfCsv({
      foods:
        '\ufeffFood_Code,Food_Description_EN,Food_Description_FR\n1,Egg,Œuf\n',
      nutrients:
        '\ufeffNutrient_Code,Nutrient_Unit,Nutrient_Name_EN\n208,kilocalorie,Energy (kilocalories)\n317,Microgram,Selenium\n999,International Unit,Vitamin D (International Units)\n',
      foodNutrients:
        'Food_Code,Nutrient_Code,Nutrient_Amount\n1,208,143\n1,317,20\n1,999,400\n',
    });
    expect(foods[0]?.name).toBe('Egg');
    expect(foods[0]?.authoritativeAliases).toEqual(['Œuf']);
    expect(foods[0]?.nutrients.map((nutrient) => nutrient.key)).toEqual([
      'calories',
      'selenium',
    ]);
    expect(
      mapProviderNutrient('Retinol activity equivalents', '20', 'Microgram'),
    ).toBeNull();
    expect(
      mapProviderNutrient('Vitamin D (International Units)', '400', 'IU'),
    ).toBeNull();
  });

  it('joins Ciqual English canonical names with French and scientific aliases', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Food composition');
    sheet.addRow(['alim_code', 'Protein (g)', 'Energy (kcal)']);
    sheet.addRow(['1001', 12, 143]);
    const parsed = await parseCiqual({
      compositionXlsx: Buffer.from(await workbook.xlsx.writeBuffer()),
      metadataXml:
        '<root><food alim_code="1001" alim_nom_fr="Œuf de poule" alim_nom_eng="Egg, chicken, whole, raw" alim_nom_sci="Gallus gallus domesticus ovum" /></root>',
    });
    expect(parsed[0]?.name).toBe('Egg, chicken, whole, raw');
    expect(parsed[0]?.authoritativeAliases).toEqual([
      'Œuf de poule',
      'Gallus gallus domesticus ovum',
    ]);
    expect(parsed[0]?.nutrients.map((nutrient) => nutrient.key)).toEqual([
      'protein',
      'calories',
    ]);
    const nextRelease = await parseCiqual({
      compositionXlsx: Buffer.from(await workbook.xlsx.writeBuffer()),
      metadataXml:
        '<root><food alim_code="1001" alim_nom_fr="Œuf de poule" alim_nom_eng="Egg, chicken, whole, raw" alim_nom_sci="Gallus gallus domesticus ovum" /></root>',
      release: '2026',
    });
    expect(nextRelease[0]?.sourceRecordHash).not.toBe(
      parsed[0]?.sourceRecordHash,
    );
  });

  it('joins CoFID nutrient worksheets and preserves Tr/N as unknown', async () => {
    const workbook = new ExcelJS.Workbook();
    const proximates = workbook.addWorksheet('1.3 Proximates');
    proximates.addRow([
      'Food Code',
      'Food Name',
      'Description',
      'Group',
      'Protein (g)',
      'Energy (kcal)',
    ]);
    proximates.addRow(['13-1', 'Test egg', 'raw', 'Eggs', 12, 143]);
    const inorganics = workbook.addWorksheet('1.4 Inorganics');
    inorganics.addRow([
      'Food Code',
      'Food Name',
      'Description',
      'Group',
      'Sodium (mg)',
    ]);
    inorganics.addRow(['13-1', 'Test egg', 'raw', 'Eggs', 'N']);
    const parsed = await parseCofid(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.nutrients.map((nutrient) => nutrient.key)).toEqual([
      'protein',
      'calories',
    ]);
    expect(parsed[0]?.servingWeightGrams).toBe(100);
  });

  it('normalizes aliases deterministically while retaining display spelling', () => {
    expect(normalizeIdentityText('Œuf de poule')).toBe('oeuf de poule');
    expect(dedupeAliases('Crème', ['crème', 'Creme', 'Pâté'])).toEqual([
      'Pâté',
    ]);
    expect(
      providerSearchText({
        name: 'Egg, chicken, whole, raw',
        authoritativeAliases: ['Œuf de poule entier cru'],
        brandName: null,
        category: 'Œufs',
        preparation: 'cru',
      }),
    ).toContain('oeuf de poule entier cru');
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

  it('does not mutate duplicate provider rows twice during persistence', async () => {
    const createCalls: string[] = [];
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
    const fakePrisma = {
      foodDatasetRelease: {
        upsert: async () => undefined,
        update: async () => undefined,
      },
      foodItem: {
        findFirst: async () => null,
        create: async () => {
          createCalls.push('create');
          return { id: 'food-1' };
        },
        updateMany: async () => undefined,
      },
      foodItemNutrient: {
        deleteMany: async () => undefined,
        createMany: async () => undefined,
      },
    };
    const result = await persistProviderFoods({
      prisma: fakePrisma as never,
      rows: [row, row],
      sourceUri: 'https://example.test/cnf.csv',
      sourceSha256: 'sha',
    });
    expect(createCalls).toEqual(['create']);
    expect(result).toMatchObject({ imported: 1, skipped: 1 });
  });

  it('does not persist rows rejected for non-finite nutrient amounts', async () => {
    const createCalls: string[] = [];
    const row = {
      provider: 'cnf' as const,
      release: '2026',
      sourceId: 'invalid-nutrient',
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
      nutrients: [
        {
          key: 'protein',
          amount: Number.NaN,
          unit: 'g' as const,
          sourceLabel: 'Protein',
          sourceUnit: 'g',
          sourceValue: 'tr',
        },
      ],
      sourceRecordHash: 'invalid',
    };
    const fakePrisma = {
      foodDatasetRelease: {
        upsert: async () => undefined,
        update: async () => undefined,
      },
      foodItem: {
        findFirst: async () => null,
        create: async () => {
          createCalls.push('create');
          return { id: 'food-1' };
        },
        updateMany: async () => undefined,
      },
      foodItemNutrient: {
        deleteMany: async () => undefined,
        createMany: async () => undefined,
      },
    };
    const result = await persistProviderFoods({
      prisma: fakePrisma as never,
      rows: [row],
      sourceUri: 'https://example.test/cnf.csv',
      sourceSha256: 'sha',
    });
    expect(createCalls).toEqual([]);
    expect(result).toMatchObject({ imported: 0, skipped: 0, rejected: 1 });
  });

  it('records a failed release when a persistence batch aborts', async () => {
    const statuses: string[] = [];
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
    const fakePrisma = {
      foodDatasetRelease: {
        upsert: async () => undefined,
        update: async ({ data }: { data: { status: string } }) => {
          statuses.push(data.status);
        },
      },
      foodItem: {
        findFirst: async () => null,
        create: async () => {
          throw new Error('simulated persistence failure');
        },
      },
      foodItemNutrient: {
        deleteMany: async () => undefined,
        createMany: async () => undefined,
      },
    };
    await expect(
      persistProviderFoods({
        prisma: fakePrisma as never,
        rows: [row],
        sourceUri: 'https://example.test/cnf.csv',
        sourceSha256: 'sha',
      }),
    ).rejects.toThrow('simulated persistence failure');
    expect(statuses).toEqual(['failed']);
  });
});

describe('hybrid retrieval policy', () => {
  it('shares source classification, alias propagation, and candidate dedupe', () => {
    const foodItem = {
      id: 'food-1',
      name: 'Egg, chicken, whole, raw',
      authoritativeAliases: ['Œuf de poule entier cru'],
      sourceType: 'app_owned',
      sourceProvider: 'ciqual',
      sourceId: '1001',
      servingOptions: null,
    } as FoodItem;
    const candidate = foodItemCandidate({
      foodItem,
      matchReason: candidateMatchReason({
        sourceType: foodItem.sourceType,
        sourceProvider: foodItem.sourceProvider,
        hasBarcode: false,
      }),
      rank: 1,
    });
    expect(candidate.matchReason).toBe('reference');
    expect(
      candidate.candidateType === 'food_item'
        ? candidate.foodItem.authoritativeAliases
        : null,
    ).toEqual(['Œuf de poule entier cru']);
    const candidates = [] as (typeof candidate)[];
    const seen = new Set<string>();
    expect(appendUniqueCandidate({ candidates, seen, candidate })).toBe(true);
    expect(appendUniqueCandidate({ candidates, seen, candidate })).toBe(false);
    expect(candidates).toHaveLength(1);
  });

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
      identity: { authoritativeAliases: [] },
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

  it('builds a versioned global search document without nutrient vectors', () => {
    const document = searchDocumentForFood({
      id: 'food-1',
      name: 'Plain yogurt',
      aliases: ['Yaourt nature'],
      brandName: null,
      category: 'Dairy',
      preparation: 'plain',
      sourceProvider: 'ciqual',
      sourceRegion: 'FR',
      sourceType: 'app_owned',
      rankingClass: 'reference',
      datasetRelease: '2025',
      hasBarcode: false,
    });
    expect(document.text).toContain('Yaourt nature');
    expect(document).not.toHaveProperty('nutrients');
    expect(versionedNamespace('food-search')).toContain('food-search-');
    expect(
      buildIndexVersionRecord({ namespace: 'next', documentCount: 1 }),
    ).toMatchObject({
      indexVersion: semanticIndexVersion(),
      embeddingModel: 'multilingual-e5-large',
      documentCount: 1,
      status: 'building',
    });
    expect(staleSearchDocumentIds(['a', 'b', 'b'], ['b', 'c'])).toEqual(['a']);
  });

  it('keeps Pinecone response parsing and timeout degradation bounded', async () => {
    expect(semanticModelVersion('custom-model')).toBe('custom-model');
    expect(semanticIndexVersionName('food-search-v2')).toBe('food-search-v2');
    expect(
      parseSemanticSearchResponse({
        result: {
          hits: [
            { _id: 'food-1', _score: 0.8, fields: { region: 'CA' } },
            { _score: 0.7 },
          ],
        },
      }),
    ).toEqual([
      {
        foodItemId: 'food-1',
        score: 0.8,
        metadata: { region: 'CA' },
      },
    ]);
    await expect(
      boundedSemanticSearch(
        new Promise((resolve) => setTimeout(() => resolve('late'), 25)),
        1,
      ),
    ).rejects.toThrow('Pinecone search timeout');
  });
});
