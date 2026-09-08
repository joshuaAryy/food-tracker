import { COLUMN_BACKED_NUTRIENT_KEYS } from '@food-tracker/shared';
import {
  FoodSourceProvider,
  PrismaClient,
  type NutrientKey,
} from '@prisma/client';
import { topLevelNutritionFromNutrients } from '../modules/foodItems/providers/importer.js';

const prisma = new PrismaClient();
const REFERENCE_PROVIDERS = [
  FoodSourceProvider.cnf,
  FoodSourceProvider.ciqual,
  FoodSourceProvider.cofid,
] as const;

const NUTRITION_KEYS = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'sodium',
] as const;

type NutritionFields = ReturnType<typeof topLevelNutritionFromNutrients>;
type RepairField = keyof NutritionFields;

interface RepairSummary {
  dryRun: boolean;
  scanned: number;
  eligible: number;
  alreadyCorrect: number;
  changed: number;
  missingNormalizedBasis: number;
  beforeMissingCore: number;
  afterMissingCore: number;
  verifiedAfterMissingCore: number | null;
  foodsWithColumnBackedNutrients: number;
  columnBackedNutrientRows: number;
  removedColumnBackedNutrientRows: number | null;
  verifiedColumnBackedNutrientRows: number | null;
  cnfServingBasisCandidates: number;
  changedCnfServingBasisRows: number;
  verifiedNonCanonicalCnfServingBasisRows: number | null;
  changedByProvider: Record<string, number>;
}

type FoodItemRepairData = Partial<NutritionFields> & {
  servingQuantity?: number;
  servingUnit?: string;
  servingWeightGrams?: number;
};

function isMissingCoreNutrition(
  nutrition: Pick<NutritionFields, 'calories' | 'protein'>,
): boolean {
  return nutrition.calories === null || nutrition.protein === null;
}

function repairData(
  current: Record<RepairField, number | null>,
  target: NutritionFields,
): Partial<NutritionFields> {
  const data: Partial<NutritionFields> = {};
  for (const key of NUTRITION_KEYS) {
    const expected = target[key];
    if (expected !== null && current[key] !== expected) {
      data[key] = expected;
    }
  }
  return data;
}

function cnfServingBasisRepairData(input: {
  sourceProvider: FoodSourceProvider | null;
  servingQuantity: number | null;
  servingUnit: string | null;
  servingWeightGrams: number | null;
}): Partial<FoodItemRepairData> {
  if (
    input.sourceProvider !== FoodSourceProvider.cnf ||
    (input.servingQuantity === 100 &&
      input.servingUnit === 'g' &&
      input.servingWeightGrams === 100)
  ) {
    return {};
  }
  return {
    servingQuantity: 100,
    servingUnit: 'g',
    servingWeightGrams: 100,
  };
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--apply');
  const foods = await prisma.foodItem.findMany({
    where: {
      userId: null,
      archivedAt: null,
      sourceType: 'app_owned',
      rankingClass: 'reference',
      sourceProvider: { in: [...REFERENCE_PROVIDERS] },
    },
    select: {
      id: true,
      sourceProvider: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
      fiber: true,
      sugar: true,
      sodium: true,
      servingQuantity: true,
      servingUnit: true,
      servingWeightGrams: true,
      nutrients: {
        select: { nutrientKey: true, amount: true },
      },
    },
    orderBy: [{ sourceProvider: 'asc' }, { id: 'asc' }],
  });

  const summary: RepairSummary = {
    dryRun,
    scanned: foods.length,
    eligible: 0,
    alreadyCorrect: 0,
    changed: 0,
    missingNormalizedBasis: 0,
    beforeMissingCore: 0,
    afterMissingCore: 0,
    verifiedAfterMissingCore: null,
    foodsWithColumnBackedNutrients: 0,
    columnBackedNutrientRows: 0,
    removedColumnBackedNutrientRows: null,
    verifiedColumnBackedNutrientRows: null,
    cnfServingBasisCandidates: 0,
    changedCnfServingBasisRows: 0,
    verifiedNonCanonicalCnfServingBasisRows: null,
    changedByProvider: {},
  };
  const pendingUpdates: Array<{
    id: string;
    data: FoodItemRepairData;
  }> = [];
  const pendingDeletes: string[] = [];

  for (const food of foods) {
    const columnBackedNutrients = food.nutrients.filter((nutrient) =>
      COLUMN_BACKED_NUTRIENT_KEYS.includes(
        nutrient.nutrientKey as (typeof COLUMN_BACKED_NUTRIENT_KEYS)[number],
      ),
    );
    if (columnBackedNutrients.length > 0) {
      summary.foodsWithColumnBackedNutrients += 1;
      summary.columnBackedNutrientRows += columnBackedNutrients.length;
      if (!dryRun) {
        pendingDeletes.push(food.id);
      }
    }
    const current = {
      calories: food.calories,
      protein: food.protein === null ? null : Number(food.protein),
      carbs: food.carbs === null ? null : Number(food.carbs),
      fat: food.fat === null ? null : Number(food.fat),
      fiber: food.fiber === null ? null : Number(food.fiber),
      sugar: food.sugar === null ? null : Number(food.sugar),
      sodium: food.sodium,
    } satisfies Record<RepairField, number | null>;
    const servingData = cnfServingBasisRepairData({
      sourceProvider: food.sourceProvider,
      servingQuantity:
        food.servingQuantity === null ? null : Number(food.servingQuantity),
      servingUnit: food.servingUnit,
      servingWeightGrams:
        food.servingWeightGrams === null
          ? null
          : Number(food.servingWeightGrams),
    });
    if (Object.keys(servingData).length > 0) {
      summary.cnfServingBasisCandidates += 1;
      summary.changedCnfServingBasisRows += 1;
    }
    const target = topLevelNutritionFromNutrients(
      food.nutrients.map((nutrient) => ({
        nutrientKey: nutrient.nutrientKey as NutrientKey,
        amount: Number(nutrient.amount),
      })),
    );

    const currentMissingCore = isMissingCoreNutrition(current);
    const targetMissingCore = isMissingCoreNutrition(target);
    if (currentMissingCore) summary.beforeMissingCore += 1;
    if (targetMissingCore && currentMissingCore) {
      summary.missingNormalizedBasis += 1;
      summary.afterMissingCore += 1;
      if (!dryRun && Object.keys(servingData).length > 0) {
        pendingUpdates.push({ id: food.id, data: servingData });
      }
      continue;
    }

    summary.eligible += 1;
    const data: FoodItemRepairData = {
      ...servingData,
      ...(targetMissingCore ? {} : repairData(current, target)),
    };
    if (Object.keys(data).length === 0) {
      summary.alreadyCorrect += 1;
      continue;
    }

    summary.changed += 1;
    const provider = food.sourceProvider ?? 'unknown';
    summary.changedByProvider[provider] =
      (summary.changedByProvider[provider] ?? 0) + 1;
    if (!dryRun) {
      pendingUpdates.push({ id: food.id, data });
    }
  }

  if (!dryRun) {
    const updateBatchSize = 32;
    for (
      let offset = 0;
      offset < pendingUpdates.length;
      offset += updateBatchSize
    ) {
      const batch = pendingUpdates.slice(offset, offset + updateBatchSize);
      await Promise.all(
        batch.map(({ id, data }) =>
          prisma.foodItem.update({ where: { id }, data }),
        ),
      );
    }
  }

  if (!dryRun) {
    const deleteBatchSize = 32;
    let removedColumnBackedNutrientRows = 0;
    for (
      let offset = 0;
      offset < pendingDeletes.length;
      offset += deleteBatchSize
    ) {
      const batch = pendingDeletes.slice(offset, offset + deleteBatchSize);
      const deleted = await Promise.all(
        batch.map((foodItemId) =>
          prisma.foodItemNutrient.deleteMany({
            where: {
              foodItemId,
              nutrientKey: { in: [...COLUMN_BACKED_NUTRIENT_KEYS] },
            },
          }),
        ),
      );
      removedColumnBackedNutrientRows += deleted.reduce(
        (total, result) => total + result.count,
        0,
      );
    }
    summary.removedColumnBackedNutrientRows = removedColumnBackedNutrientRows;

    summary.verifiedAfterMissingCore = await prisma.foodItem.count({
      where: {
        userId: null,
        archivedAt: null,
        sourceType: 'app_owned',
        rankingClass: 'reference',
        sourceProvider: { in: [...REFERENCE_PROVIDERS] },
        OR: [{ calories: null }, { protein: null }],
      },
    });
    summary.verifiedColumnBackedNutrientRows =
      await prisma.foodItemNutrient.count({
        where: {
          nutrientKey: { in: [...COLUMN_BACKED_NUTRIENT_KEYS] },
          foodItem: {
            is: {
              userId: null,
              archivedAt: null,
              sourceType: 'app_owned',
              rankingClass: 'reference',
              sourceProvider: { in: [...REFERENCE_PROVIDERS] },
            },
          },
        },
      });
    summary.verifiedNonCanonicalCnfServingBasisRows =
      await prisma.foodItem.count({
        where: {
          userId: null,
          archivedAt: null,
          sourceType: 'app_owned',
          rankingClass: 'reference',
          sourceProvider: FoodSourceProvider.cnf,
          OR: [
            { servingQuantity: null },
            { servingQuantity: { not: 100 } },
            { servingUnit: null },
            { servingUnit: { not: 'g' } },
            { servingWeightGrams: null },
            { servingWeightGrams: { not: 100 } },
          ],
        },
      });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
