import { Prisma } from '@prisma/client';
import {
  recipeIngredientSnapshotSchema,
  type CanonicalDecimalString,
  type RecipeIngredientSnapshot,
  type RecipeMaterializedNutrition,
  type RecipeNutritionSnapshot,
  type RecipeNutritionSummarySnapshot,
} from '@food-tracker/shared';
import {
  calculateAuthoritativeServing,
  type AuthoritativeServingCalculationInput,
} from '../foodLogs/serving-resolution.js';

Prisma.Decimal.set({ precision: 40, rounding: Prisma.Decimal.ROUND_HALF_UP });

type RecipeIngredientCalculationInput = AuthoritativeServingCalculationInput & {
  foodItem: { id: string; name: string };
};

type RecipeNutritionResult = {
  total: RecipeNutritionSummarySnapshot;
  perPortion: RecipeNutritionSummarySnapshot;
  perGram: RecipeNutritionSummarySnapshot | null;
};

type ColumnKey =
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'fiber'
  | 'sugar'
  | 'sodium';

function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function canonical(value: Prisma.Decimal | number): CanonicalDecimalString {
  return (
    value instanceof Prisma.Decimal ? value : decimal(value)
  ).toString() as CanonicalDecimalString;
}

function canonicalOptional(
  value: number | null,
): CanonicalDecimalString | null {
  return value === null ? null : canonical(value);
}

function scaledCanonical(
  value: number | null,
  multiplier: number,
): CanonicalDecimalString | null {
  return value === null
    ? null
    : canonical(decimal(value).mul(decimal(multiplier)));
}

function materialize(
  nutrition: RecipeNutritionSnapshot,
): RecipeMaterializedNutrition {
  const rounded = (value: string, places: number) =>
    decimal(value)
      .toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP)
      .toNumber();
  const roundedOptional = (value: string | null, places: number) =>
    value === null ? null : rounded(value, places);

  return {
    calories: rounded(nutrition.calories, 0),
    protein: rounded(nutrition.protein, 1),
    carbs: roundedOptional(nutrition.carbs, 1),
    fat: roundedOptional(nutrition.fat, 1),
    fiber: roundedOptional(nutrition.fiber, 1),
    sugar: roundedOptional(nutrition.sugar, 1),
    sodium: roundedOptional(nutrition.sodium, 0),
    nutrients: Object.fromEntries(
      Object.entries(nutrition.nutrients).map(([key, nutrient]) => [
        key,
        { amount: rounded(nutrient.amount, 4), unit: nutrient.unit },
      ]),
    ),
  };
}

function summary(
  fullPrecision: RecipeNutritionSnapshot,
): RecipeNutritionSummarySnapshot {
  return { fullPrecision, materialized: materialize(fullPrecision) };
}

function divideNutrition(
  nutrition: RecipeNutritionSnapshot,
  divisor: number | string,
): RecipeNutritionSnapshot {
  const divide = (value: string) => canonical(decimal(value).div(divisor));
  const optional = (value: string | null) =>
    value === null ? null : divide(value);
  return {
    calories: divide(nutrition.calories),
    protein: divide(nutrition.protein),
    carbs: optional(nutrition.carbs),
    fat: optional(nutrition.fat),
    fiber: optional(nutrition.fiber),
    sugar: optional(nutrition.sugar),
    sodium: optional(nutrition.sodium),
    nutrients: Object.fromEntries(
      Object.entries(nutrition.nutrients).map(([key, nutrient]) => [
        key,
        { amount: divide(nutrient.amount), unit: nutrient.unit },
      ]),
    ),
  };
}

export function scaleRecipeNutrition(
  nutrition: RecipeNutritionSnapshot,
  multiplier: number | string,
): RecipeNutritionSnapshot {
  const scale = (value: string) => canonical(decimal(value).mul(multiplier));
  const optional = (value: string | null) =>
    value === null ? null : scale(value);
  return {
    calories: scale(nutrition.calories),
    protein: scale(nutrition.protein),
    carbs: optional(nutrition.carbs),
    fat: optional(nutrition.fat),
    fiber: optional(nutrition.fiber),
    sugar: optional(nutrition.sugar),
    sodium: optional(nutrition.sodium),
    nutrients: Object.fromEntries(
      Object.entries(nutrition.nutrients).map(([key, nutrient]) => [
        key,
        { amount: scale(nutrient.amount), unit: nutrient.unit },
      ]),
    ),
  };
}

export function roundRecipeNutritionForFoodLog(
  nutrition: RecipeNutritionSnapshot,
): RecipeNutritionSnapshot {
  const round = (value: string, places: number) =>
    canonical(
      decimal(value).toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP),
    );
  const optional = (value: string | null, places: number) =>
    value === null ? null : round(value, places);
  return {
    calories: round(nutrition.calories, 0),
    protein: round(nutrition.protein, 1),
    carbs: optional(nutrition.carbs, 1),
    fat: optional(nutrition.fat, 1),
    fiber: optional(nutrition.fiber, 1),
    sugar: optional(nutrition.sugar, 1),
    sodium: optional(nutrition.sodium, 0),
    nutrients: Object.fromEntries(
      Object.entries(nutrition.nutrients).map(([key, nutrient]) => [
        key,
        { amount: round(nutrient.amount, 4), unit: nutrient.unit },
      ]),
    ),
  };
}

function aggregateNutrition(
  ingredients: readonly RecipeIngredientSnapshot[],
): RecipeNutritionSnapshot {
  const aggregateColumn = (key: ColumnKey): CanonicalDecimalString | null => {
    const values = ingredients.map(
      (ingredient) => ingredient.resolvedNutrition[key],
    );
    if (values.every((value) => value === null)) return null;
    return canonical(
      values.reduce(
        (sum, value) => sum.plus(value === null ? 0 : value),
        new Prisma.Decimal(0),
      ),
    );
  };
  const nutrientKeys = new Set(
    ingredients.flatMap((ingredient) =>
      Object.keys(ingredient.resolvedNutrition.nutrients),
    ),
  );

  return {
    calories: aggregateColumn('calories')!,
    protein: aggregateColumn('protein')!,
    carbs: aggregateColumn('carbs'),
    fat: aggregateColumn('fat'),
    fiber: aggregateColumn('fiber'),
    sugar: aggregateColumn('sugar'),
    sodium: aggregateColumn('sodium'),
    nutrients: Object.fromEntries(
      [...nutrientKeys].sort().map((key) => {
        const nutrient = ingredients
          .map(
            (ingredient) =>
              ingredient.resolvedNutrition.nutrients[
                key as keyof typeof ingredient.resolvedNutrition.nutrients
              ],
          )
          .find((value) => value !== undefined)!;
        const amount = ingredients.reduce(
          (sum, ingredient) =>
            sum.plus(
              ingredient.resolvedNutrition.nutrients[
                key as keyof typeof ingredient.resolvedNutrition.nutrients
              ]?.amount ?? 0,
            ),
          new Prisma.Decimal(0),
        );
        return [key, { amount: canonical(amount), unit: nutrient.unit }];
      }),
    ),
  };
}

export function createRecipeIngredientSnapshot(
  input: RecipeIngredientCalculationInput,
): RecipeIngredientSnapshot {
  const result = calculateAuthoritativeServing(input);
  if (!result.ok)
    throw new Error(`Recipe ingredient serving failed: ${result.code}`);
  const multiplier = result.servingSnapshot.resolution.multiplier;

  const snapshot = {
    schemaVersion: 1,
    foodItem: input.foodItem,
    nutritionBasis: {
      quantity: canonical(input.basis.quantity),
      unit: result.servingSnapshot.nutritionBasis.unit,
      unitFamily: result.servingSnapshot.nutritionBasis.unitFamily,
      displayText: input.basis.displayText,
      equivalentWeightGrams: canonicalOptional(
        input.basis.equivalentWeightGrams,
      ),
      equivalentVolumeMl: canonicalOptional(input.basis.equivalentVolumeMl),
    },
    requestedServing: {
      quantity: canonical(result.servingSnapshot.requestedServing.quantity),
      unit: result.servingSnapshot.requestedServing.unit,
      unitFamily: result.servingSnapshot.requestedServing.unitFamily,
      servingOptionId: result.servingSnapshot.requestedServing.servingOptionId,
      selectedServingOption:
        result.servingSnapshot.requestedServing.selectedServingOption === null
          ? null
          : {
              ...result.servingSnapshot.requestedServing.selectedServingOption,
              quantity: canonical(
                result.servingSnapshot.requestedServing.selectedServingOption
                  .quantity,
              ),
              equivalentWeightGrams: canonicalOptional(
                result.servingSnapshot.requestedServing.selectedServingOption
                  .equivalentWeightGrams,
              ),
              equivalentVolumeMl: canonicalOptional(
                result.servingSnapshot.requestedServing.selectedServingOption
                  .equivalentVolumeMl,
              ),
            },
    },
    resolution: {
      ...result.servingSnapshot.resolution,
      multiplier: canonical(result.servingSnapshot.resolution.multiplier),
      resolvedWeightGrams: canonicalOptional(
        result.servingSnapshot.resolution.resolvedWeightGrams,
      ),
      resolvedVolumeMl: canonicalOptional(
        result.servingSnapshot.resolution.resolvedVolumeMl,
      ),
    },
    resolvedNutrition: {
      calories: scaledCanonical(input.basisNutrition.calories, multiplier)!,
      protein: scaledCanonical(input.basisNutrition.protein, multiplier)!,
      carbs: scaledCanonical(input.basisNutrition.carbs, multiplier),
      fat: scaledCanonical(input.basisNutrition.fat, multiplier),
      fiber: scaledCanonical(input.basisNutrition.fiber, multiplier),
      sugar: scaledCanonical(input.basisNutrition.sugar, multiplier),
      sodium: scaledCanonical(input.basisNutrition.sodium, multiplier),
      nutrients: Object.fromEntries(
        Object.entries(input.basisNutrition.nutrients).map(
          ([key, nutrient]) => [
            key,
            {
              amount: scaledCanonical(nutrient.amount, multiplier)!,
              unit: nutrient.unit,
            },
          ],
        ),
      ),
    },
    provenance: input.provenance,
  };
  return recipeIngredientSnapshotSchema.parse(snapshot);
}

export function aggregateRecipeIngredientSnapshots(input: {
  ingredients: readonly RecipeIngredientSnapshot[];
  portionCount: number;
  finalCookedWeightGrams: number | null;
}): RecipeNutritionResult {
  if (!Number.isInteger(input.portionCount) || input.portionCount <= 0) {
    throw new Error('Recipe portion count must be a positive integer.');
  }
  if (input.ingredients.length === 0) {
    throw new Error('Recipe requires at least one ingredient.');
  }
  if (
    input.finalCookedWeightGrams !== null &&
    input.finalCookedWeightGrams <= 0
  ) {
    throw new Error('Recipe cooked weight must be positive when provided.');
  }

  const total = aggregateNutrition(input.ingredients);
  return {
    total: summary(total),
    perPortion: summary(divideNutrition(total, input.portionCount)),
    perGram:
      input.finalCookedWeightGrams === null
        ? null
        : summary(divideNutrition(total, input.finalCookedWeightGrams)),
  };
}
