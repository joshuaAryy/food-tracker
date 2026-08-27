import type { NutrientKey, NutrientUnit, PrismaClient } from '@prisma/client';
import { NUTRIENT_CATALOG } from '@food-tracker/shared';
import {
  normalizeIdentityText,
  providerSearchText,
  type NormalizedProviderFood,
} from './normalized.js';

export interface ImportCounts {
  imported: number;
  updated: number;
  skipped: number;
  rejected: number;
}

export interface ImportRunResult extends ImportCounts {
  provider: NormalizedProviderFood['provider'];
  release: string;
  dryRun: boolean;
}

export interface ImportProgress {
  processed: number;
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  rejected: number;
}

type ImportProgressReporter = (progress: ImportProgress) => void;

export type RowPersistenceStep =
  | 'food-item-persisted'
  | 'nutrients-deleted'
  | 'nutrients-persisted';

interface RowPersistenceStepEvent {
  step: RowPersistenceStep;
  row: NormalizedProviderFood;
}

type RowPersistenceStepReporter = (event: RowPersistenceStepEvent) => void;

interface ExistingProviderFood {
  id: string;
  sourceId: string | null;
  sourceRecordHash: string | null;
  nutrients: Array<{
    nutrientKey: NutrientKey;
    amount: unknown;
    unit: NutrientUnit;
    sourceProvider: string | null;
    sourceRecordId: string | null;
    sourceRelease: string | null;
  }>;
}

const PERSISTENCE_CONCURRENCY = 8;

function validImportRow(row: NormalizedProviderFood): boolean {
  return (
    row.sourceId.length > 0 &&
    row.name.length > 0 &&
    row.nutrients.every((nutrient) => Number.isFinite(nutrient.amount))
  );
}

function importIdentity(row: NormalizedProviderFood): string {
  return `${row.provider}:${row.release}:${row.sourceId}`;
}

export function countImportRows(
  rows: readonly NormalizedProviderFood[],
): ImportCounts {
  const seen = new Set<string>();
  let rejected = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!validImportRow(row)) {
      rejected += 1;
      continue;
    }
    const key = importIdentity(row);
    if (seen.has(key)) skipped += 1;
    seen.add(key);
  }
  return { imported: seen.size, updated: 0, skipped, rejected };
}

function uniqueValidRows(
  rows: readonly NormalizedProviderFood[],
): NormalizedProviderFood[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!validImportRow(row)) return false;
    const key = importIdentity(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface CanonicalNutrient {
  nutrientKey: NutrientKey;
  amount: number;
  unit: NutrientUnit;
  sourceProvider: NormalizedProviderFood['provider'];
  sourceRecordId: string;
  sourceRelease: string;
}

function canonicalNutrients(row: NormalizedProviderFood): CanonicalNutrient[] {
  const nutrients = new Map<NutrientKey, CanonicalNutrient>();
  for (const nutrient of row.nutrients) {
    if (!(nutrient.key in NUTRIENT_CATALOG)) continue;
    const nutrientKey = nutrient.key as NutrientKey;
    if (nutrients.has(nutrientKey)) continue;
    nutrients.set(nutrientKey, {
      nutrientKey,
      amount: nutrient.amount,
      unit: nutrient.unit as NutrientUnit,
      sourceProvider: row.provider,
      sourceRecordId: row.sourceId,
      sourceRelease: row.release,
    });
  }
  return [...nutrients.values()];
}

function nutrientsMatch(
  existing: readonly ExistingProviderFood['nutrients'][number][],
  expected: readonly CanonicalNutrient[],
): boolean {
  if (existing.length !== expected.length) return false;
  const existingByKey = new Map(
    existing.map((nutrient) => [nutrient.nutrientKey, nutrient]),
  );
  return expected.every((nutrient) => {
    const persisted = existingByKey.get(nutrient.nutrientKey);
    return (
      persisted !== undefined &&
      Number(persisted.amount) === nutrient.amount &&
      persisted.unit === nutrient.unit &&
      persisted.sourceProvider === nutrient.sourceProvider &&
      persisted.sourceRecordId === nutrient.sourceRecordId &&
      persisted.sourceRelease === nutrient.sourceRelease
    );
  });
}

function foodItemData(row: NormalizedProviderFood) {
  return {
    userId: null,
    name: row.name,
    brandName: row.brandName,
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
    rankingClass: 'reference' as const,
    datasetRelease: row.release,
    sourceRecordHash: row.sourceRecordHash,
    sourceType: 'app_owned' as const,
    // A building release stays invisible until all bounded batches finish.
    archivedAt: new Date(),
  };
}

async function persistProviderRow(input: {
  prisma: PrismaClient;
  row: NormalizedProviderFood;
  existing: ExistingProviderFood | undefined;
  onStep?: RowPersistenceStepReporter;
}): Promise<'imported' | 'updated' | 'skipped'> {
  const expectedNutrients = canonicalNutrients(input.row);
  if (
    input.existing?.sourceRecordHash === input.row.sourceRecordHash &&
    nutrientsMatch(input.existing.nutrients, expectedNutrients)
  ) {
    return 'skipped';
  }

  await input.prisma.$transaction(async (transaction) => {
    const data = foodItemData(input.row);
    const item =
      input.existing === undefined
        ? await transaction.foodItem.create({ data })
        : await transaction.foodItem.update({
            where: { id: input.existing.id },
            data,
          });
    input.onStep?.({ step: 'food-item-persisted', row: input.row });
    await transaction.foodItemNutrient.deleteMany({
      where: { foodItemId: item.id },
    });
    input.onStep?.({ step: 'nutrients-deleted', row: input.row });
    if (expectedNutrients.length > 0) {
      await transaction.foodItemNutrient.createMany({
        data: expectedNutrients.map((nutrient) => ({
          foodItemId: item.id,
          nutrientKey: nutrient.nutrientKey,
          amount: nutrient.amount,
          unit: nutrient.unit,
          sourceProvider: nutrient.sourceProvider,
          sourceRecordId: nutrient.sourceRecordId,
          sourceRelease: nutrient.sourceRelease,
        })),
        skipDuplicates: true,
      });
    }
    input.onStep?.({ step: 'nutrients-persisted', row: input.row });
  });
  return input.existing === undefined ? 'imported' : 'updated';
}

async function forEachBounded<T>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  let firstError: unknown;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value === undefined || firstError !== undefined) continue;
      try {
        await operation(value);
      } catch (error) {
        firstError ??= error;
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      worker,
    ),
  );
  if (firstError !== undefined) throw firstError;
}

export async function persistProviderFoods(input: {
  prisma: PrismaClient;
  rows: readonly NormalizedProviderFood[];
  sourceUri: string;
  sourceSha256: string;
  batchSize?: number;
  dryRun?: boolean;
  onProgress?: ImportProgressReporter;
  onRowPersistenceStep?: RowPersistenceStepReporter;
}): Promise<ImportRunResult> {
  const first = input.rows[0];
  if (first === undefined)
    throw new Error('Cannot import an empty provider dataset');
  const release = first.release;
  const provider = first.provider;
  const counts = countImportRows(input.rows);
  if (input.dryRun === true)
    return { ...counts, provider, release, dryRun: true };
  const batchSize = Math.max(1, Math.min(input.batchSize ?? 250, 1000));
  const rowsToPersist = uniqueValidRows(input.rows);
  const existingRelease = await input.prisma.foodDatasetRelease.findUnique({
    where: { provider_release: { provider, release } },
    select: { sourceUri: true, sourceSha256: true, status: true },
  });
  if (
    existingRelease !== null &&
    (existingRelease.sourceUri !== input.sourceUri ||
      existingRelease.sourceSha256 !== input.sourceSha256)
  ) {
    throw new Error(
      `Pinned artifact identity conflicts with existing ${provider} ${release} release`,
    );
  }
  if (existingRelease?.status === 'active') {
    return {
      provider,
      release,
      imported: 0,
      updated: 0,
      skipped: rowsToPersist.length + counts.skipped,
      rejected: counts.rejected,
      dryRun: false,
    };
  }
  await input.prisma.foodDatasetRelease.upsert({
    where: { provider_release: { provider, release } },
    create: {
      provider,
      release,
      sourceUri: input.sourceUri,
      sourceSha256: input.sourceSha256,
      status: 'building',
    },
    update: {
      sourceUri: input.sourceUri,
      sourceSha256: input.sourceSha256,
      status: 'building',
      completedAt: null,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      rejectedCount: 0,
    },
  });
  try {
    let imported = 0;
    let updated = 0;
    let skipped = counts.skipped;
    for (let offset = 0; offset < rowsToPersist.length; offset += batchSize) {
      const batch = rowsToPersist.slice(offset, offset + batchSize);
      const existingRows = await input.prisma.foodItem.findMany({
        where: {
          sourceProvider: provider,
          sourceId: { in: batch.map((row) => row.sourceId) },
          datasetRelease: release,
        },
        select: {
          id: true,
          sourceId: true,
          sourceRecordHash: true,
          nutrients: {
            select: {
              nutrientKey: true,
              amount: true,
              unit: true,
              sourceProvider: true,
              sourceRecordId: true,
              sourceRelease: true,
            },
          },
        },
      });
      const existingBySourceId = new Map(
        existingRows.map((row) => [row.sourceId, row]),
      );
      await forEachBounded(batch, PERSISTENCE_CONCURRENCY, async (row) => {
        const existing = existingBySourceId.get(row.sourceId);
        const outcome = await persistProviderRow({
          prisma: input.prisma,
          row,
          existing,
          ...(input.onRowPersistenceStep === undefined
            ? {}
            : { onStep: input.onRowPersistenceStep }),
        });
        if (outcome === 'imported') imported += 1;
        else if (outcome === 'updated') updated += 1;
        else skipped += 1;
      });
      input.onProgress?.({
        processed: Math.min(offset + batch.length, rowsToPersist.length),
        total: rowsToPersist.length,
        imported,
        updated,
        skipped,
        rejected: counts.rejected,
      });
    }
    const persistedCount = await input.prisma.foodItem.count({
      where: {
        sourceProvider: provider,
        datasetRelease: release,
        userId: null,
      },
    });
    if (persistedCount !== rowsToPersist.length) {
      throw new Error(
        `Incomplete ${provider} ${release} persistence: expected ${rowsToPersist.length}, found ${persistedCount}`,
      );
    }
    const completedAt = new Date();
    await input.prisma.$transaction(async (transaction) => {
      await transaction.foodItem.updateMany({
        where: {
          sourceProvider: provider,
          datasetRelease: { not: release },
          userId: null,
          archivedAt: null,
        },
        data: { archivedAt: completedAt },
      });
      await transaction.foodDatasetRelease.updateMany({
        where: {
          provider,
          release: { not: release },
          status: 'active',
        },
        data: { status: 'retired' },
      });
      await transaction.foodItem.updateMany({
        where: {
          sourceProvider: provider,
          datasetRelease: release,
          userId: null,
        },
        data: { archivedAt: null },
      });
      await transaction.foodDatasetRelease.update({
        where: { provider_release: { provider, release } },
        data: {
          status: 'active',
          importedCount: imported,
          updatedCount: updated,
          skippedCount: skipped,
          rejectedCount: counts.rejected,
          completedAt,
        },
      });
    });
    return {
      provider,
      release,
      imported,
      updated,
      skipped,
      rejected: counts.rejected,
      dryRun: false,
    };
  } catch (error) {
    try {
      await input.prisma.foodDatasetRelease.update({
        where: { provider_release: { provider, release } },
        data: { status: 'failed' },
      });
    } catch {
      // Preserve the original import failure if failure recording is unavailable.
    }
    throw error;
  }
}
