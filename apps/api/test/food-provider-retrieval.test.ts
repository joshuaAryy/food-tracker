import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { NutrientKey } from '@prisma/client';
import type { FoodItem } from '@food-tracker/shared';
import { prisma } from '../src/lib/prisma.js';
import { FOOD_RETRIEVAL_CORPUS } from '../src/benchmarks/food-retrieval/corpus.js';
import { retrieveLiveBenchmarkObservation } from '../src/benchmarks/food-retrieval/live.js';
import { parseCnfCsv } from '../src/modules/foodItems/providers/cnf.js';
import { parseCiqual } from '../src/modules/foodItems/providers/ciqual.js';
import { parseCofid } from '../src/modules/foodItems/providers/cofid.js';
import {
  mapCiqualNutrient,
  mapProviderNutrient,
} from '../src/modules/foodItems/providers/nutrient-mapping.js';
import ExcelJS from 'exceljs';
import {
  countImportRows,
  persistProviderFoods,
} from '../src/modules/foodItems/providers/importer.js';
import {
  dedupeAliases,
  normalizeIdentityText,
  providerSearchText,
  type NormalizedProviderFood,
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
  retrieveFuzzyFoodItemMatches,
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
import { globalSemanticFoodWhere } from '../src/modules/foodItems/retrieval/global-scope.js';
import {
  buildGlobalSearchDocuments,
  globalSearchFoodWhere,
} from '../src/modules/foodItems/retrieval/global-scope.js';
import {
  buildIndexVersionRecord,
  resolveActiveSemanticNamespace,
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
  function importRow(input: {
    provider?: 'cnf' | 'ciqual' | 'cofid';
    release: string;
    sourceId: string;
    hash: string;
    protein?: number;
    nutrients?: NormalizedProviderFood['nutrients'];
  }): NormalizedProviderFood {
    return {
      provider: input.provider ?? 'cnf',
      release: input.release,
      sourceId: input.sourceId,
      name: `Food ${input.sourceId}`,
      authoritativeAliases: [],
      brandName: null,
      foodType: 'generic',
      category: null,
      preparation: null,
      region: 'CA',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      nutrients: input.nutrients ?? [
        {
          key: 'protein',
          amount: input.protein ?? 10,
          unit: 'g',
          sourceLabel: 'Protein',
          sourceUnit: 'g',
          sourceValue: String(input.protein ?? 10),
        },
      ],
      sourceRecordHash: input.hash,
    };
  }

  async function seedBuildingRow(
    row: NormalizedProviderFood,
    nutrients: NormalizedProviderFood['nutrients'] = row.nutrients,
  ) {
    const sourceUri = `https://example.test/${row.provider}-${row.release}.csv`;
    const sourceSha256 = `${row.provider}-${row.release}-sha`;
    await prisma.foodDatasetRelease.upsert({
      where: {
        provider_release: { provider: row.provider, release: row.release },
      },
      create: {
        provider: row.provider,
        release: row.release,
        sourceUri,
        sourceSha256,
        status: 'building',
      },
      update: { sourceUri, sourceSha256, status: 'building' },
    });
    const item = await prisma.foodItem.create({
      data: {
        userId: null,
        name: row.name,
        brandName: row.brandName,
        sourceType: 'app_owned',
        foodType: row.foodType,
        normalizedName: normalizeIdentityText(row.name),
        normalizedBrandName:
          row.brandName === null ? null : normalizeIdentityText(row.brandName),
        searchText: providerSearchText(row),
        servingQuantity: row.servingQuantity,
        servingUnit: row.servingUnit,
        servingWeightGrams: row.servingWeightGrams,
        sourceProvider: row.provider,
        sourceId: row.sourceId,
        sourceUpdatedAt: new Date(),
        sourceAliases: row.authoritativeAliases,
        sourceRegion: row.region,
        rankingClass: 'reference',
        datasetRelease: row.release,
        sourceRecordHash: row.sourceRecordHash,
        archivedAt: new Date(),
      },
    });
    await prisma.foodItemNutrient.createMany({
      data: nutrients.map((nutrient) => ({
        foodItemId: item.id,
        nutrientKey: nutrient.key as NutrientKey,
        amount: nutrient.amount,
        unit: nutrient.unit,
        sourceProvider: row.provider,
        sourceRecordId: row.sourceId,
        sourceRelease: row.release,
      })),
    });
    return { sourceUri, sourceSha256, item };
  }

  async function clearImportRelease(provider: 'cnf', release: string) {
    await prisma.foodDatasetRelease.deleteMany({
      where: { provider, release },
    });
  }

  it('pins exactly the three approved official datasets', () => {
    expect(FOOD_DATASET_MANIFESTS.map((entry) => entry.provider)).toEqual([
      'cnf',
      'ciqual',
      'cofid',
    ]);
    expect(manifestFor('ciqual', '2025')).toMatchObject({
      sourceUrl: 'https://doi.org/10.57745/RDMHWY',
      artifactSha256:
        '5555c572fa3735991298d832d0427788fa69a11b4fd20a5d580d58942369fbb0',
      companionArtifactSha256:
        'e0b1de25b3039028205e9d54a96892e403e1b313c2efeb41180fabe132627478',
    });
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

  it('maps official Ciqual French columns with explicit semantic preferences', () => {
    const mapped = (
      [
        ['Protéines, N x facteur de Jones (g 100 g)', '12', 'g'],
        ['Glucides (g 100 g)', '20', 'g'],
        ['Lipides (g 100 g)', '5', 'g'],
        ['Sucres (g 100 g)', '4', 'g'],
        ['Fibres alimentaires (g 100 g)', '3', 'g'],
        ['Sodium (mg 100 g)', '25', 'mg'],
      ] as const
    ).map(([label, value, unit]) => mapCiqualNutrient(label, value, unit));
    expect(mapped.map((nutrient) => nutrient?.key)).toEqual([
      'protein',
      'carbs',
      'fat',
      'sugar',
      'fiber',
      'sodium',
    ]);
    expect(mapped[5]?.unit).toBe('mg');

    expect(
      mapCiqualNutrient('Sel chlorure de sodium (g 100 g)', '5', 'g'),
    ).toBeNull();
    expect(
      mapCiqualNutrient(
        'Energie, Règlement UE N° 1169 2011 (kcal 100 g)',
        143,
        'kcal',
      ),
    ).toMatchObject({ key: 'calories', amount: 143, unit: 'kcal' });
    expect(
      mapCiqualNutrient(
        'Energie, N x facteur Jones, avec fibres (kcal 100 g)',
        150,
        'kcal',
      ),
    ).toBeNull();
  });

  it('keeps Ciqual alternative vitamin representations separate and preserves unknowns', () => {
    expect(
      mapCiqualNutrient(
        'Activité vitaminique A, équivalents rétinol (µg 100 g)',
        400,
        'µg',
      ),
    ).toMatchObject({ key: 'vitaminA', amount: 400, unit: 'mcg' });
    expect(mapCiqualNutrient('Rétinol (µg 100 g)', 100, 'µg')).toBeNull();
    expect(mapCiqualNutrient('Vitamine D (µg 100 g)', 2, 'µg')).toMatchObject({
      key: 'vitaminD',
    });
    expect(mapCiqualNutrient('Vitamine D2 (µg 100 g)', 1, 'µg')).toBeNull();
    expect(
      mapCiqualNutrient('Vitamine B9 ou Folates totaux (µg 100 g)', 80, 'µg'),
    ).toMatchObject({ key: 'folate', amount: 80, unit: 'mcg' });
    expect(
      mapCiqualNutrient(
        'Vitamine B9 ou Folates totaux, équivalents folates alimentaires, DFE (µg 100 g)',
        90,
        'µg',
      ),
    ).toBeNull();
    expect(mapCiqualNutrient('Vitamine K1 (µg 100 g)', 1, 'µg')).toBeNull();
    expect(mapCiqualNutrient('Vitamine E (mg 100 g)', 2, 'mg')).toBeNull();
    expect(
      mapCiqualNutrient('Alpha-tocophérol (vitamine E) (mg 100 g)', 2, 'mg'),
    ).toMatchObject({ key: 'vitaminE', amount: 2, unit: 'mg' });

    expect(mapCiqualNutrient('Sodium (mg 100 g)', 0, 'mg')).toMatchObject({
      key: 'sodium',
      amount: 0,
    });
    expect(mapCiqualNutrient('Sodium (mg 100 g)', 'Tr', 'mg')).toBeNull();
    expect(mapCiqualNutrient('Sodium (mg 100 g)', 'N', 'mg')).toBeNull();
    expect(mapCiqualNutrient('Sodium (mg 100 g)', '', 'mg')).toBeNull();
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

  it('reports bounded persistence progress without changing the final result', async () => {
    const release = 'test-progress-2026';
    await clearImportRelease('cnf', release);
    const rows = [
      importRow({ release, sourceId: 'progress-1', hash: 'progress-hash-1' }),
      importRow({ release, sourceId: 'progress-2', hash: 'progress-hash-2' }),
    ];
    const progress: number[] = [];
    try {
      const result = await persistProviderFoods({
        prisma,
        rows,
        sourceUri: 'https://example.test/cnf-progress.csv',
        sourceSha256: 'progress-sha',
        batchSize: 1,
        onProgress: ({ processed, total }) => {
          expect(total).toBe(2);
          progress.push(processed);
        },
      });
      expect(progress).toEqual([1, 2]);
      expect(result).toMatchObject({
        imported: 2,
        updated: 0,
        skipped: 0,
        rejected: 0,
        dryRun: false,
      });
    } finally {
      await clearImportRelease('cnf', release);
    }
  });

  it('rolls back a new FoodItem when row persistence fails before nutrients', async () => {
    const release = 'test-row-rollback-create-2026';
    await clearImportRelease('cnf', release);
    const row = importRow({
      release,
      sourceId: 'row-rollback-create',
      hash: 'row-rollback-create-hash',
    });
    try {
      await expect(
        persistProviderFoods({
          prisma,
          rows: [row],
          sourceUri: `https://example.test/cnf-${release}.csv`,
          sourceSha256: `cnf-${release}-sha`,
          onRowPersistenceStep: ({ step }) => {
            if (step === 'food-item-persisted') {
              throw new Error('failure before nutrient replacement');
            }
          },
        }),
      ).rejects.toThrow('failure before nutrient replacement');
      expect(
        await prisma.foodItem.count({
          where: { sourceProvider: 'cnf', datasetRelease: release },
        }),
      ).toBe(0);
      expect(
        await prisma.foodItemNutrient.count({
          where: { sourceProvider: 'cnf', sourceRelease: release },
        }),
      ).toBe(0);

      await persistProviderFoods({
        prisma,
        rows: [row],
        sourceUri: `https://example.test/cnf-${release}.csv`,
        sourceSha256: `cnf-${release}-sha`,
      });
      expect(
        await prisma.foodItemNutrient.count({
          where: { sourceProvider: 'cnf', sourceRelease: release },
        }),
      ).toBe(1);
    } finally {
      await clearImportRelease('cnf', release);
    }
  });

  it('rolls back a changed-hash update when FoodItem mutation fails', async () => {
    const release = 'test-row-rollback-update-2026';
    await clearImportRelease('cnf', release);
    const original = importRow({
      release,
      sourceId: 'row-rollback-update',
      hash: 'row-rollback-update-old',
      protein: 10,
    });
    const changed = importRow({
      release,
      sourceId: original.sourceId,
      hash: 'row-rollback-update-new',
      protein: 20,
    });
    try {
      await seedBuildingRow(original);
      await expect(
        persistProviderFoods({
          prisma,
          rows: [changed],
          sourceUri: `https://example.test/cnf-${release}.csv`,
          sourceSha256: `cnf-${release}-sha`,
          onRowPersistenceStep: ({ step }) => {
            if (step === 'food-item-persisted') {
              throw new Error('failure after FoodItem update');
            }
          },
        }),
      ).rejects.toThrow('failure after FoodItem update');
      const persisted = await prisma.foodItem.findFirstOrThrow({
        where: { sourceProvider: 'cnf', datasetRelease: release },
        include: { nutrients: true },
      });
      expect(persisted.sourceRecordHash).toBe(original.sourceRecordHash);
      expect(persisted.nutrients).toHaveLength(1);
      expect(Number(persisted.nutrients[0]?.amount)).toBe(10);

      await persistProviderFoods({
        prisma,
        rows: [changed],
        sourceUri: `https://example.test/cnf-${release}.csv`,
        sourceSha256: `cnf-${release}-sha`,
      });
      const repaired = await prisma.foodItem.findFirstOrThrow({
        where: { sourceProvider: 'cnf', datasetRelease: release },
        include: { nutrients: true },
      });
      expect(repaired.sourceRecordHash).toBe(changed.sourceRecordHash);
      expect(repaired.nutrients).toHaveLength(1);
      expect(Number(repaired.nutrients[0]?.amount)).toBe(20);
    } finally {
      await clearImportRelease('cnf', release);
    }
  });

  it('rolls back nutrient deletion when replacement fails after delete', async () => {
    const release = 'test-row-rollback-delete-2026';
    await clearImportRelease('cnf', release);
    const original = importRow({
      release,
      sourceId: 'row-rollback-delete',
      hash: 'row-rollback-delete-old',
      protein: 10,
    });
    const changed = importRow({
      release,
      sourceId: original.sourceId,
      hash: 'row-rollback-delete-new',
      protein: 20,
    });
    try {
      await seedBuildingRow(original);
      await expect(
        persistProviderFoods({
          prisma,
          rows: [changed],
          sourceUri: `https://example.test/cnf-${release}.csv`,
          sourceSha256: `cnf-${release}-sha`,
          onRowPersistenceStep: ({ step }) => {
            if (step === 'nutrients-deleted') {
              throw new Error('failure after nutrient deletion');
            }
          },
        }),
      ).rejects.toThrow('failure after nutrient deletion');
      const persisted = await prisma.foodItem.findFirstOrThrow({
        where: { sourceProvider: 'cnf', datasetRelease: release },
        include: { nutrients: true },
      });
      expect(persisted.sourceRecordHash).toBe(original.sourceRecordHash);
      expect(persisted.nutrients).toHaveLength(1);
      expect(Number(persisted.nutrients[0]?.amount)).toBe(10);

      await persistProviderFoods({
        prisma,
        rows: [changed],
        sourceUri: `https://example.test/cnf-${release}.csv`,
        sourceSha256: `cnf-${release}-sha`,
      });
      expect(
        await prisma.foodItemNutrient.count({
          where: { sourceProvider: 'cnf', sourceRelease: release },
        }),
      ).toBe(1);
    } finally {
      await clearImportRelease('cnf', release);
    }
  });

  it('repairs a legacy same-hash row with no persisted nutrients', async () => {
    const release = 'test-legacy-empty-nutrients-2026';
    await clearImportRelease('cnf', release);
    const row = importRow({
      release,
      sourceId: 'legacy-empty-nutrients',
      hash: 'legacy-empty-nutrients-hash',
    });
    try {
      await seedBuildingRow(row, []);
      const result = await persistProviderFoods({
        prisma,
        rows: [row],
        sourceUri: `https://example.test/cnf-${release}.csv`,
        sourceSha256: `cnf-${release}-sha`,
      });
      expect(result).toMatchObject({ imported: 0, updated: 1, skipped: 0 });
      expect(
        await prisma.foodItemNutrient.count({
          where: { sourceProvider: 'cnf', sourceRelease: release },
        }),
      ).toBe(1);
    } finally {
      await clearImportRelease('cnf', release);
    }
  });

  it('repairs a legacy same-hash row with a partial nutrient set', async () => {
    const release = 'test-legacy-partial-nutrients-2026';
    await clearImportRelease('cnf', release);
    const row = importRow({
      release,
      sourceId: 'legacy-partial-nutrients',
      hash: 'legacy-partial-nutrients-hash',
      nutrients: [
        {
          key: 'protein',
          amount: 12,
          unit: 'g',
          sourceLabel: 'Protein',
          sourceUnit: 'g',
          sourceValue: '12',
        },
        {
          key: 'calories',
          amount: 140,
          unit: 'kcal',
          sourceLabel: 'Energy',
          sourceUnit: 'kcal',
          sourceValue: '140',
        },
      ],
    });
    try {
      await seedBuildingRow(row, [row.nutrients[0]!]);
      const result = await persistProviderFoods({
        prisma,
        rows: [row],
        sourceUri: `https://example.test/cnf-${release}.csv`,
        sourceSha256: `cnf-${release}-sha`,
      });
      expect(result).toMatchObject({ imported: 0, updated: 1, skipped: 0 });
      expect(
        await prisma.foodItemNutrient.count({
          where: { sourceProvider: 'cnf', sourceRelease: release },
        }),
      ).toBe(2);
    } finally {
      await clearImportRelease('cnf', release);
    }
  });

  it('skips a legacy same-hash row when its complete nutrient set matches', async () => {
    const release = 'test-legacy-complete-nutrients-2026';
    await clearImportRelease('cnf', release);
    const row = importRow({
      release,
      sourceId: 'legacy-complete-nutrients',
      hash: 'legacy-complete-nutrients-hash',
    });
    let observedStep = false;
    try {
      await seedBuildingRow(row);
      const result = await persistProviderFoods({
        prisma,
        rows: [row],
        sourceUri: `https://example.test/cnf-${release}.csv`,
        sourceSha256: `cnf-${release}-sha`,
        onRowPersistenceStep: () => {
          observedStep = true;
        },
      });
      expect(result).toMatchObject({ imported: 0, updated: 0, skipped: 1 });
      expect(observedStep).toBe(false);
    } finally {
      await clearImportRelease('cnf', release);
    }
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
        findUnique: async () => null,
        upsert: async () => undefined,
        update: async () => undefined,
        updateMany: async () => undefined,
      },
      foodItem: {
        findMany: async () => [],
        create: async () => {
          createCalls.push('create');
          return { id: 'food-1' };
        },
        updateMany: async () => undefined,
        count: async () => 1,
      },
      foodItemNutrient: {
        deleteMany: async () => undefined,
        createMany: async () => undefined,
      },
      $transaction: async (callback: (transaction: unknown) => unknown) =>
        callback(fakePrisma),
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

  it('looks up a staged provider row for the exact release when history exists', async () => {
    let lookup: unknown;
    const row = {
      provider: 'cnf' as const,
      release: '2026',
      sourceId: 'active-row',
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
      sourceRecordHash: 'active-hash',
    };
    const fakePrisma = {
      foodDatasetRelease: {
        findUnique: async () => null,
        upsert: async () => undefined,
        update: async () => undefined,
        updateMany: async () => undefined,
      },
      foodItem: {
        findMany: async ({ where }: { where: unknown }) => {
          lookup = where;
          return [];
        },
        create: async () => ({ id: 'food-1' }),
        updateMany: async () => undefined,
        count: async () => 1,
      },
      foodItemNutrient: {
        deleteMany: async () => undefined,
        createMany: async () => undefined,
      },
      $transaction: async (callback: (transaction: unknown) => unknown) =>
        callback(fakePrisma),
    };
    await persistProviderFoods({
      prisma: fakePrisma as never,
      rows: [row],
      sourceUri: 'https://example.test/cnf.csv',
      sourceSha256: 'sha',
    });
    expect(lookup).toEqual({
      sourceProvider: 'cnf',
      sourceId: { in: ['active-row'] },
      datasetRelease: '2026',
    });
  });

  it('uses archive-aware provider uniqueness for existing duplicate history', async () => {
    const migration = await readFile(
      new URL(
        '../prisma/migrations/20260823120000_phase_18_19_food_retrieval_foundation/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migration).toContain('"archivedAt" IS NULL');
    expect(migration).toContain('FoodItem_provider_source_unique');
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    expect(migration).toContain('USING GIST');
    expect(migration).toContain('gist_trgm_ops(siglen=32)');
  });

  it('rejects a second national provider identity within one release', async () => {
    const release = 'test-unique-2026';
    await clearImportRelease('cnf', release);
    const row = importRow({
      release,
      sourceId: 'identity-1',
      hash: 'identity-hash-1',
    });
    try {
      await persistProviderFoods({
        prisma,
        rows: [row],
        sourceUri: 'https://example.test/cnf-unique.csv',
        sourceSha256: 'unique-sha',
      });
      await expect(
        prisma.foodItem.create({
          data: {
            userId: null,
            name: 'Duplicate identity',
            brandName: null,
            sourceType: 'app_owned',
            foodType: 'generic',
            normalizedName: 'duplicate identity',
            normalizedBrandName: null,
            searchText: 'duplicate identity',
            servingQuantity: 100,
            servingUnit: 'g',
            servingWeightGrams: 100,
            sourceProvider: 'cnf',
            sourceId: 'identity-1',
            sourceUpdatedAt: new Date(),
            sourceAliases: [],
            sourceRegion: 'CA',
            rankingClass: 'reference',
            datasetRelease: release,
            sourceRecordHash: 'identity-hash-2',
            archivedAt: new Date(),
          },
        }),
      ).rejects.toThrow();
    } finally {
      await clearImportRelease('cnf', release);
    }
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
        findUnique: async () => null,
        upsert: async () => undefined,
        update: async () => undefined,
        updateMany: async () => undefined,
      },
      foodItem: {
        findMany: async () => [],
        create: async () => {
          createCalls.push('create');
          return { id: 'food-1' };
        },
        updateMany: async () => undefined,
        count: async () => 0,
      },
      foodItemNutrient: {
        deleteMany: async () => undefined,
        createMany: async () => undefined,
      },
      $transaction: async (callback: (transaction: unknown) => unknown) =>
        callback(fakePrisma),
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
        findUnique: async () => null,
        upsert: async () => undefined,
        update: async ({ data }: { data: { status: string } }) => {
          statuses.push(data.status);
        },
        updateMany: async () => undefined,
      },
      foodItem: {
        findMany: async () => [],
        count: async () => 0,
        create: async () => {
          throw new Error('simulated persistence failure');
        },
      },
      foodItemNutrient: {
        deleteMany: async () => undefined,
        createMany: async () => undefined,
      },
      $transaction: async (callback: (transaction: unknown) => unknown) =>
        callback(fakePrisma),
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

  it('resumes a building release without duplicating staged foods or nutrients', async () => {
    const release = 'test-resume-2026';
    await clearImportRelease('cnf', release);
    const rows = [
      importRow({ release, sourceId: 'resume-1', hash: 'resume-hash-1' }),
      importRow({ release, sourceId: 'resume-2', hash: 'resume-hash-2' }),
    ];
    let interrupted = false;
    try {
      await expect(
        persistProviderFoods({
          prisma,
          rows,
          sourceUri: 'https://example.test/cnf-resume.csv',
          sourceSha256: 'resume-sha',
          batchSize: 1,
          onProgress: ({ processed }) => {
            if (!interrupted && processed === 1) {
              interrupted = true;
              throw new Error('simulated interruption');
            }
          },
        }),
      ).rejects.toThrow('simulated interruption');

      expect(
        await prisma.foodDatasetRelease.findUniqueOrThrow({
          where: { provider_release: { provider: 'cnf', release } },
        }),
      ).toMatchObject({ status: 'failed', completedAt: null });
      expect(
        await prisma.foodItem.count({
          where: { sourceProvider: 'cnf', datasetRelease: release },
        }),
      ).toBe(1);

      const resumed = await persistProviderFoods({
        prisma,
        rows,
        sourceUri: 'https://example.test/cnf-resume.csv',
        sourceSha256: 'resume-sha',
        batchSize: 1,
      });
      expect(resumed).toMatchObject({ imported: 1, updated: 0, skipped: 1 });
      expect(
        await prisma.foodItem.count({
          where: { sourceProvider: 'cnf', datasetRelease: release },
        }),
      ).toBe(2);
      expect(
        await prisma.foodItemNutrient.count({
          where: { sourceProvider: 'cnf', sourceRelease: release },
        }),
      ).toBe(2);

      const rerun = await persistProviderFoods({
        prisma,
        rows,
        sourceUri: 'https://example.test/cnf-resume.csv',
        sourceSha256: 'resume-sha',
      });
      expect(rerun).toMatchObject({ imported: 0, updated: 0, skipped: 2 });
      expect(
        await prisma.foodItem.count({
          where: { sourceProvider: 'cnf', datasetRelease: release },
        }),
      ).toBe(2);
      expect(
        await prisma.foodItemNutrient.count({
          where: { sourceProvider: 'cnf', sourceRelease: release },
        }),
      ).toBe(2);
      expect(
        await prisma.foodDatasetRelease.findUniqueOrThrow({
          where: { provider_release: { provider: 'cnf', release } },
        }),
      ).toMatchObject({ status: 'active' });
    } finally {
      await clearImportRelease('cnf', release);
    }
  });

  it('updates a changed staged row without creating a same-release duplicate', async () => {
    const release = 'test-update-2026';
    await clearImportRelease('cnf', release);
    const original = importRow({
      release,
      sourceId: 'changed-1',
      hash: 'changed-hash-1',
      protein: 10,
    });
    try {
      await expect(
        persistProviderFoods({
          prisma,
          rows: [original],
          sourceUri: 'https://example.test/cnf-update.csv',
          sourceSha256: 'update-sha',
          onProgress: () => {
            throw new Error('stop after staging');
          },
        }),
      ).rejects.toThrow('stop after staging');
      const changed = importRow({
        release,
        sourceId: 'changed-1',
        hash: 'changed-hash-2',
        protein: 20,
      });
      await persistProviderFoods({
        prisma,
        rows: [changed],
        sourceUri: 'https://example.test/cnf-update.csv',
        sourceSha256: 'update-sha',
      });
      expect(
        await prisma.foodItem.count({
          where: { sourceProvider: 'cnf', datasetRelease: release },
        }),
      ).toBe(1);
      expect(
        await prisma.foodItemNutrient.findMany({
          where: { sourceProvider: 'cnf', sourceRelease: release },
          select: { amount: true },
        }),
      ).toEqual([{ amount: expect.anything() }]);
      const persistedAmount = await prisma.foodItemNutrient.findFirstOrThrow({
        where: { sourceProvider: 'cnf', sourceRelease: release },
        select: { amount: true },
      });
      expect(Number(persistedAmount.amount)).toBe(20);
    } finally {
      await clearImportRelease('cnf', release);
    }
  });

  it('keeps the active release visible during replacement failure and swaps atomically on success', async () => {
    const oldRelease = 'test-active-old';
    const newRelease = 'test-active-new';
    await clearImportRelease('cnf', oldRelease);
    await clearImportRelease('cnf', newRelease);
    const oldRow = importRow({
      release: oldRelease,
      sourceId: 'shared-source',
      hash: 'old-hash',
    });
    const newRow = importRow({
      release: newRelease,
      sourceId: 'shared-source',
      hash: 'new-hash',
    });
    try {
      await persistProviderFoods({
        prisma,
        rows: [oldRow],
        sourceUri: 'https://example.test/cnf-old.csv',
        sourceSha256: 'old-sha',
      });
      await expect(
        persistProviderFoods({
          prisma,
          rows: [newRow],
          sourceUri: 'https://example.test/cnf-new.csv',
          sourceSha256: 'new-sha',
          onProgress: () => {
            throw new Error('replacement interrupted');
          },
        }),
      ).rejects.toThrow('replacement interrupted');
      expect(
        await prisma.foodItem.findFirstOrThrow({
          where: {
            sourceProvider: 'cnf',
            datasetRelease: oldRelease,
          },
        }),
      ).toMatchObject({ archivedAt: null });
      expect(
        await prisma.foodItem.findFirstOrThrow({
          where: {
            sourceProvider: 'cnf',
            datasetRelease: newRelease,
          },
        }),
      ).toMatchObject({ archivedAt: expect.any(Date) });

      await persistProviderFoods({
        prisma,
        rows: [newRow],
        sourceUri: 'https://example.test/cnf-new.csv',
        sourceSha256: 'new-sha',
      });
      expect(
        await prisma.foodItem.findFirstOrThrow({
          where: {
            sourceProvider: 'cnf',
            datasetRelease: oldRelease,
          },
        }),
      ).toMatchObject({ archivedAt: expect.any(Date) });
      expect(
        await prisma.foodItem.findFirstOrThrow({
          where: {
            sourceProvider: 'cnf',
            datasetRelease: newRelease,
          },
        }),
      ).toMatchObject({ archivedAt: null });
    } finally {
      await clearImportRelease('cnf', oldRelease);
      await clearImportRelease('cnf', newRelease);
    }
  });

  it('defines release-scoped national identity protection and conflict-safe repair', async () => {
    const migration = await readFile(
      new URL(
        '../prisma/migrations/20260827120000_national_release_identity/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migration).toContain(
      'FoodItem_national_provider_source_release_unique',
    );
    expect(migration).toContain("'cnf', 'ciqual', 'cofid'");
    expect(migration).toContain('sourceRecordHash');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).toContain('FoodItemNutrient');
    const indexes = await prisma.$queryRaw<
      { indexname: string }[]
    >`SELECT indexname FROM pg_indexes WHERE indexname = 'FoodItem_national_provider_source_release_unique'`;
    expect(indexes).toHaveLength(1);
  });
});

describe('hybrid retrieval policy', () => {
  it('rehydrates semantic IDs only from the global app-owned catalog', () => {
    expect(globalSemanticFoodWhere(['food-1'])).toEqual({
      id: { in: ['food-1'] },
      AND: [
        {
          userId: null,
          archivedAt: null,
          sourceType: 'app_owned',
          rankingClass: { in: ['reference', 'app_curated'] },
          OR: [
            { sourceProvider: null },
            { sourceProvider: { notIn: ['open_food_facts', 'usda_fdc'] } },
          ],
        },
      ],
    });
  });

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

  it('derives deterministic eligible global documents and excludes private/cached foods', () => {
    const base = {
      id: 'b',
      name: 'Reference food',
      brandName: null,
      sourceAliases: ['Alias'],
      searchText:
        'reference food alias category-only-term preparation-only-term',
      sourceProvider: 'cnf',
      sourceRegion: 'CA',
      sourceType: 'app_owned',
      rankingClass: 'reference',
      datasetRelease: '2026',
      barcodes: [],
      userId: null,
      archivedAt: null,
    } as const;
    const documents = buildGlobalSearchDocuments([
      base,
      { ...base, id: 'a', rankingClass: 'app_curated', sourceProvider: null },
      { ...base, id: 'private', userId: 'user-1' },
      { ...base, id: 'archived', archivedAt: new Date() },
      { ...base, id: 'off', sourceProvider: 'open_food_facts' },
      { ...base, id: 'usda', sourceProvider: 'usda_fdc' },
    ]);
    expect(documents.map((document) => document.id)).toEqual(['a', 'b']);
    expect(documents[0]?.text).toContain('Reference food');
    expect(documents[0]?.text).toContain('Alias');
    expect(documents[0]?.text).toContain('category-only-term');
    expect(documents[0]?.text).toContain('preparation-only-term');
    expect(documents[0]).not.toHaveProperty('nutrients');
    expect(globalSearchFoodWhere()).toMatchObject({
      userId: null,
      archivedAt: null,
      sourceType: 'app_owned',
      rankingClass: { in: ['reference', 'app_curated'] },
    });
  });

  it('resolves the active semantic namespace with a safe fallback', async () => {
    const active = await resolveActiveSemanticNamespace({
      prisma: {
        foodSearchIndexVersion: {
          findFirst: async () => ({ namespace: 'food-search-next-v2' }),
        },
      } as never,
      fallback: 'food-search-v1',
    });
    expect(active).toBe('food-search-next-v2');
    const fallback = await resolveActiveSemanticNamespace({
      prisma: {
        foodSearchIndexVersion: {
          findFirst: async () => {
            throw new Error('table unavailable');
          },
        },
      } as never,
      fallback: 'food-search-v1',
    });
    expect(fallback).toBe('food-search-v1');
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

describe('PostgreSQL fuzzy retrieval', () => {
  async function createFood(input: {
    searchText: string;
    archivedAt?: Date | null;
    sourceProvider?: 'usda_fdc' | 'cnf';
    sourceType?: 'app_owned' | 'cached_external';
    rankingClass?: 'app_curated' | 'reference';
  }) {
    return prisma.foodItem.create({
      data: {
        userId: null,
        name: input.searchText,
        normalizedName: input.searchText.toLowerCase(),
        searchText: input.searchText.toLowerCase(),
        sourceType: input.sourceType ?? 'app_owned',
        foodType: 'generic',
        sourceProvider: input.sourceProvider ?? null,
        sourceId:
          input.sourceProvider === undefined
            ? null
            : `${input.searchText}-${randomUUID()}`,
        rankingClass: input.rankingClass ?? 'app_curated',
        calories: 100,
        protein: 10,
        archivedAt: input.archivedAt ?? null,
      },
    });
  }

  it('runs legacy, dataset, and fuzzy benchmark channels against PostgreSQL', async () => {
    await createFood({
      searchText: 'Greek yogurt, plain',
      sourceProvider: 'usda_fdc',
      sourceType: 'cached_external',
      rankingClass: 'reference',
    });
    await createFood({
      searchText: 'Greek yogurt, plain, reference',
      sourceProvider: 'cnf',
      sourceType: 'app_owned',
      rankingClass: 'reference',
    });
    const query = FOOD_RETRIEVAL_CORPUS.find(
      (entry) => entry.query === 'greek yogrt',
    );
    if (query === undefined) throw new Error('benchmark query missing');
    const exactQuery = { ...query, query: 'greek yogurt' };

    const legacyObservation = await retrieveLiveBenchmarkObservation({
      prisma,
      query: exactQuery,
      mode: 'legacy',
      limit: 100,
    });
    const datasetObservation = await retrieveLiveBenchmarkObservation({
      prisma,
      query: exactQuery,
      mode: 'datasets',
      limit: 100,
    });
    const fuzzyObservation = await retrieveLiveBenchmarkObservation({
      prisma,
      query,
      mode: 'fuzzy',
      limit: 100,
    });

    expect(
      legacyObservation.candidates.some(
        (candidate) =>
          candidate.provider === 'usda_fdc' &&
          candidate.name === 'Greek yogurt, plain',
      ),
    ).toBe(true);
    expect(
      legacyObservation.candidates.some(
        (candidate) => candidate.provider === 'cnf',
      ),
    ).toBe(false);
    expect(
      datasetObservation.candidates.some(
        (candidate) =>
          candidate.provider === 'cnf' &&
          candidate.name === 'Greek yogurt, plain, reference',
      ),
    ).toBe(true);
    expect(
      fuzzyObservation.candidates.find(
        (candidate) =>
          candidate.provider === 'usda_fdc' &&
          candidate.name === 'Greek yogurt, plain',
      )?.evidence,
    ).toBe('fuzzy');
  });

  it('executes quoted camelCase SQL and excludes archived foods', async () => {
    const active = await createFood({ searchText: 'greek yogurt' });
    const archived = await createFood({
      searchText: 'greek yoghurt',
      archivedAt: new Date(),
    });

    const matches = await retrieveFuzzyFoodItemMatches({
      prisma,
      query: 'greek yogrt',
      limit: 10,
    });

    expect(matches.map((match) => match.id)).toContain(active.id);
    expect(matches.map((match) => match.id)).not.toContain(archived.id);
  });

  it('executes the strict-word KNN operator and returns strict distance', async () => {
    const food = await createFood({ searchText: 'strictwordfixture suffix' });
    const strictQuery = fuzzyCandidateQueries('strictword', 10)[1];
    if (strictQuery === undefined)
      throw new Error('strict fuzzy query missing');
    const rows =
      await prisma.$queryRaw<
        Array<{ id: string; distance: number; kind: string }>
      >(strictQuery);
    const expected = await prisma.$queryRaw<Array<{ distance: number }>>`
      SELECT 1 - strict_word_similarity('strictword', 'strictwordfixture suffix') AS distance
    `;
    const word = await prisma.$queryRaw<Array<{ distance: number }>>`
      SELECT 1 - word_similarity('strictword', 'strictwordfixture suffix') AS distance
    `;

    expect(rows.find((row) => row.id === food.id)?.kind).toBe('strict_word');
    expect(rows.find((row) => row.id === food.id)?.distance).toBeCloseTo(
      expected[0]?.distance ?? Number.NaN,
      5,
    );
    expect(rows.find((row) => row.id === food.id)?.distance).not.toBeCloseTo(
      word[0]?.distance ?? Number.NaN,
      5,
    );
  });

  it('uses the active-row GiST trigram index contract', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'FoodItem'
        AND indexname = 'FoodItem_searchText_trgm_idx'
    `;
    const indexDefinition = indexes[0]?.indexdef ?? '';
    expect(indexDefinition).toContain('USING gist');
    expect(indexDefinition).toMatch(/gist_trgm_ops\s*\(siglen='?32'?\)/);
    expect(indexDefinition).toContain('"archivedAt" IS NULL');
  });
});
