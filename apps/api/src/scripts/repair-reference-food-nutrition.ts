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
  changedByProvider: Record<string, number>;
}

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
    changedByProvider: {},
  };
  const pendingUpdates: Array<{
    id: string;
    data: Partial<NutritionFields>;
  }> = [];

  for (const food of foods) {
    const current = {
      calories: food.calories,
      protein: food.protein === null ? null : Number(food.protein),
      carbs: food.carbs === null ? null : Number(food.carbs),
      fat: food.fat === null ? null : Number(food.fat),
      fiber: food.fiber === null ? null : Number(food.fiber),
      sugar: food.sugar === null ? null : Number(food.sugar),
      sodium: food.sodium,
    } satisfies Record<RepairField, number | null>;
    const target = topLevelNutritionFromNutrients(
      food.nutrients.map((nutrient) => ({
        nutrientKey: nutrient.nutrientKey as NutrientKey,
        amount: Number(nutrient.amount),
      })),
    );

    if (isMissingCoreNutrition(current)) summary.beforeMissingCore += 1;
    if (isMissingCoreNutrition(target)) {
      summary.missingNormalizedBasis += 1;
      if (isMissingCoreNutrition(current)) summary.afterMissingCore += 1;
      continue;
    }

    summary.eligible += 1;
    const data = repairData(current, target);
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
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
