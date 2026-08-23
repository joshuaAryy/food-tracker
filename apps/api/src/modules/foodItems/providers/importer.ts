import {
  PrismaClient,
  type NutrientKey,
  type NutrientUnit,
} from '@prisma/client';
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

export function countImportRows(
  rows: readonly NormalizedProviderFood[],
): ImportCounts {
  const seen = new Set<string>();
  let rejected = 0;
  let skipped = 0;
  for (const row of rows) {
    if (
      !row.sourceId ||
      !row.name ||
      row.nutrients.some((nutrient) => !Number.isFinite(nutrient.amount))
    ) {
      rejected += 1;
      continue;
    }
    const key = `${row.provider}:${row.sourceId}`;
    if (seen.has(key)) skipped += 1;
    seen.add(key);
  }
  return { imported: seen.size - rejected, updated: 0, skipped, rejected };
}

export async function persistProviderFoods(input: {
  prisma: PrismaClient;
  rows: readonly NormalizedProviderFood[];
  sourceUri: string;
  sourceSha256: string;
  batchSize?: number;
  dryRun?: boolean;
}): Promise<ImportRunResult> {
  const first = input.rows[0];
  if (first === undefined)
    throw new Error('Cannot import an empty provider dataset');
  const release = first.release;
  const provider = first.provider;
  const counts = countImportRows(input.rows);
  if (input.dryRun === true)
    return { ...counts, provider, release, dryRun: true };
  const batchSize = Math.max(25, Math.min(input.batchSize ?? 250, 1000));
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
    },
  });
  try {
    let imported = 0;
    let updated = 0;
    let skipped = counts.skipped;
    for (let offset = 0; offset < input.rows.length; offset += batchSize) {
      const batch = input.rows.slice(offset, offset + batchSize);
      for (const row of batch) {
        if (!row.sourceId || !row.name) continue;
        const existing = await input.prisma.foodItem.findFirst({
          where: { sourceProvider: provider, sourceId: row.sourceId },
        });
        const data = {
          userId: null,
          name: row.name,
          brandName: row.brandName,
          foodType: row.foodType,
          normalizedName: normalizeIdentityText(row.name),
          normalizedBrandName:
            row.brandName === null
              ? null
              : normalizeIdentityText(row.brandName),
          searchText: providerSearchText(row),
          servingQuantity: row.servingQuantity,
          servingUnit: row.servingUnit,
          servingWeightGrams: row.servingWeightGrams,
          sourceProvider: provider,
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
        if (existing?.sourceRecordHash === row.sourceRecordHash) {
          skipped += 1;
          continue;
        }
        const item =
          existing === null
            ? await input.prisma.foodItem.create({ data })
            : await input.prisma.foodItem.update({
                where: { id: existing.id },
                data,
              });
        if (existing === null) imported += 1;
        else updated += 1;
        await input.prisma.foodItemNutrient.deleteMany({
          where: { foodItemId: item.id },
        });
        const nutrientRows = row.nutrients
          .filter((nutrient) => nutrient.key in NUTRIENT_CATALOG)
          .map((nutrient) => ({
            foodItemId: item.id,
            nutrientKey: nutrient.key as NutrientKey,
            amount: nutrient.amount,
            unit: nutrient.unit as NutrientUnit,
            sourceProvider: row.provider,
            sourceRecordId: row.sourceId,
            sourceRelease: row.release,
          }));
        if (nutrientRows.length > 0)
          await input.prisma.foodItemNutrient.createMany({
            data: nutrientRows,
            skipDuplicates: true,
          });
      }
    }
    await input.prisma.foodItem.updateMany({
      where: { sourceProvider: provider, datasetRelease: release },
      data: { archivedAt: null },
    });
    await input.prisma.foodItem.updateMany({
      where: {
        sourceProvider: provider,
        datasetRelease: { not: release },
        userId: null,
      },
      data: { archivedAt: new Date() },
    });
    await input.prisma.foodDatasetRelease.update({
      where: { provider_release: { provider, release } },
      data: {
        status: 'active',
        importedCount: imported,
        updatedCount: updated,
        skippedCount: skipped,
        rejectedCount: counts.rejected,
        completedAt: new Date(),
      },
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
