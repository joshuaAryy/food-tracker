import {
  classifyServingUnit,
  foodItemServingOptionsSchema,
  foodLogServingSnapshotSchema,
  resolveServingRequest,
  roundServingNutritionForStorage,
  scaleNutritionAtFullPrecision,
  validateServingQuantity,
  type FoodItemServingOptions,
  type FoodLogNutritionOverride,
  type FoodLogServingSnapshot,
  type NormalizedNutrientKey,
  type NutrientUnit,
  type ScalableNutrition,
  type ServingResolution,
  type ServingResolutionReason,
} from '@food-tracker/shared';

export type AuthoritativeServingCalculationInput = {
  basis: {
    quantity: number;
    unit: string;
    displayText: string | null;
    equivalentWeightGrams: number | null;
    equivalentVolumeMl: number | null;
  };
  basisNutrition: ScalableNutrition & { calories: number; protein: number };
  servingOptions: unknown | FoodItemServingOptions | null;
  serving?: { quantity: number; unit: string; servingOptionId?: string | null };
  servingMultiplier?: number;
  nutritionOverride?: FoodLogNutritionOverride | null;
  provenance: FoodLogServingSnapshot['provenance'];
};

export type AuthoritativeServingCalculationFailure = {
  ok: false;
  code:
    | 'SERVING_CONFLICT'
    | 'INVALID_SERVING_BASIS'
    | 'INVALID_SERVING_REQUEST'
    | 'SERVING_NEEDS_REVIEW'
    | 'SERVING_RESOLUTION_INVALID';
  status: 'needs_review' | 'invalid';
  reason: ServingResolutionReason | 'serving_conflict' | 'invalid_basis';
};

export type AuthoritativeServingCalculationSuccess = {
  ok: true;
  fullPrecisionNutrition: ScalableNutrition;
  finalNutrition: ScalableNutrition;
  finalNutrients: Array<{
    nutrientKey: NormalizedNutrientKey;
    amount: number;
    unit: NutrientUnit;
  }>;
  servingSnapshot: FoodLogServingSnapshot;
  servingResolution: ServingResolution;
};

export type AuthoritativeServingCalculationResult =
  | AuthoritativeServingCalculationSuccess
  | AuthoritativeServingCalculationFailure;

export class AuthoritativeServingInvariantError extends Error {
  readonly code = 'SERVING_SNAPSHOT_INVALID';

  constructor() {
    super('The authoritative serving snapshot failed validation.');
    this.name = 'AuthoritativeServingInvariantError';
  }
}

function normalizedOptions(value: unknown): FoodItemServingOptions['options'] {
  const parsed = foodItemServingOptionsSchema.safeParse(value);
  return parsed.success ? parsed.data.options : [];
}

function normalizedEquivalent(value: number | null): number | null {
  return value !== null && validateServingQuantity(value).success
    ? value
    : null;
}

function failureForResolution(
  resolution: ServingResolution,
): AuthoritativeServingCalculationFailure {
  if (resolution.status === 'needs_review') {
    return {
      ok: false,
      code: 'SERVING_NEEDS_REVIEW',
      status: 'needs_review',
      reason: resolution.reason,
    };
  }

  if (
    resolution.reason === 'invalid_quantity' ||
    resolution.reason === 'unsupported_unit'
  ) {
    return {
      ok: false,
      code: 'INVALID_SERVING_REQUEST',
      status: 'invalid',
      reason: resolution.reason,
    };
  }

  return {
    ok: false,
    code: 'SERVING_RESOLUTION_INVALID',
    status: 'invalid',
    reason: resolution.reason,
  };
}

function roundOverrideNutrition(
  scaled: ScalableNutrition,
  override: FoodLogNutritionOverride | null | undefined,
): { nutrition: ScalableNutrition; snapshot: unknown } {
  if (override === null || override === undefined) {
    return { nutrition: scaled, snapshot: null };
  }

  const nutrition: ScalableNutrition = {
    ...scaled,
    nutrients: { ...scaled.nutrients },
  };
  let effective = false;
  const field = <T>(applied: boolean, value: T | null) =>
    applied
      ? { applied: true as const, value }
      : { applied: false as const, value: null };

  const calories = override.calories;
  const caloriesApplied = calories !== undefined && calories !== null;
  if (caloriesApplied) nutrition.calories = Math.round(calories);
  const protein = override.protein;
  const proteinApplied = protein !== undefined && protein !== null;
  if (proteinApplied) nutrition.protein = roundDecimal(protein, 1);

  const applyNullable = <K extends 'carbs' | 'fat' | 'fiber' | 'sugar'>(
    key: K,
  ) => {
    const value = override[key];
    if (value !== undefined)
      nutrition[key] = value === null ? null : roundDecimal(value, 1);
    return value !== undefined;
  };
  const carbsApplied = applyNullable('carbs');
  const fatApplied = applyNullable('fat');
  const fiberApplied = applyNullable('fiber');
  const sugarApplied = applyNullable('sugar');
  const sodium = override.sodium;
  const sodiumApplied = sodium !== undefined;
  if (sodiumApplied)
    nutrition.sodium = sodium === null ? null : Math.round(sodium);

  const nutrients = override.nutrients;
  const nutrientsApplied =
    nutrients !== undefined &&
    (nutrients === null || Object.keys(nutrients).length > 0);
  if (nutrientsApplied) {
    if (nutrients === null) {
      nutrition.nutrients = {};
    } else {
      for (const [nutrientKey, nutrient] of Object.entries(nutrients)) {
        if (nutrient.amount === null) {
          delete nutrition.nutrients[nutrientKey as NormalizedNutrientKey];
        } else {
          nutrition.nutrients[nutrientKey as NormalizedNutrientKey] = {
            amount: roundDecimal(nutrient.amount, 4),
            unit: nutrient.unit,
          };
        }
      }
    }
  }
  for (const patch of override.nutrientPatches ?? []) {
    if (patch.state === 'unknown') {
      delete nutrition.nutrients[patch.nutrientKey];
    } else {
      nutrition.nutrients[patch.nutrientKey] = {
        amount: roundDecimal(patch.amount, 4),
        unit: patch.unit,
      };
    }
  }
  const nutrientPatchesApplied = (override.nutrientPatches?.length ?? 0) > 0;

  effective =
    caloriesApplied ||
    proteinApplied ||
    carbsApplied ||
    fatApplied ||
    fiberApplied ||
    sugarApplied ||
    sodiumApplied ||
    nutrientsApplied ||
    nutrientPatchesApplied;
  if (!effective) return { nutrition, snapshot: null };

  return {
    nutrition,
    snapshot: {
      semantics: 'post_scale_absolute_v1',
      mode: override.mode,
      calories: field(caloriesApplied, nutrition.calories),
      protein: field(proteinApplied, nutrition.protein),
      carbs: field(carbsApplied, nutrition.carbs),
      fat: field(fatApplied, nutrition.fat),
      fiber: field(fiberApplied, nutrition.fiber),
      sugar: field(sugarApplied, nutrition.sugar),
      sodium: field(sodiumApplied, nutrition.sodium),
      nutrients: field(
        nutrientsApplied || nutrientPatchesApplied,
        nutrients === null ? null : nutrition.nutrients,
      ),
    },
  };
}

function roundDecimal(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateAuthoritativeServing(
  input: AuthoritativeServingCalculationInput,
): AuthoritativeServingCalculationResult {
  if (input.serving !== undefined && input.servingMultiplier !== undefined) {
    return {
      ok: false,
      code: 'SERVING_CONFLICT',
      status: 'invalid',
      reason: 'serving_conflict',
    };
  }

  const basisUnit = classifyServingUnit(input.basis.unit);
  if (
    !validateServingQuantity(input.basis.quantity).success ||
    basisUnit === null
  ) {
    return {
      ok: false,
      code: 'INVALID_SERVING_BASIS',
      status: 'invalid',
      reason: 'invalid_basis',
    };
  }

  const request = input.serving ?? {
    quantity: input.basis.quantity * (input.servingMultiplier ?? 1),
    unit: basisUnit.unit,
  };
  const servingOptions = normalizedOptions(input.servingOptions);
  const servingResolution = resolveServingRequest({
    request,
    basis: {
      quantity: input.basis.quantity,
      unit: basisUnit.unit,
      ...(input.basis.displayText === null
        ? {}
        : { displayText: input.basis.displayText }),
    },
    servingOptions,
  });
  if (
    (servingResolution.status !== 'exact' &&
      servingResolution.status !== 'converted') ||
    servingResolution.multiplier === null ||
    servingResolution.requestedQuantity === null ||
    servingResolution.requestedUnit === null ||
    servingResolution.requestedUnitFamily === null
  ) {
    return failureForResolution(servingResolution);
  }

  const fullPrecisionNutrition = scaleNutritionAtFullPrecision(
    input.basisNutrition,
    servingResolution.multiplier,
  );
  const scaled = roundServingNutritionForStorage(fullPrecisionNutrition);
  const overridden = roundOverrideNutrition(scaled, input.nutritionOverride);
  const selectedServingOption =
    servingResolution.servingOptionId === null
      ? null
      : (servingOptions.find(
          (option) => option.id === servingResolution.servingOptionId,
        ) ?? null);
  const snapshotCandidate = {
    schemaVersion: 1,
    nutritionBasis: {
      quantity: input.basis.quantity,
      unit: basisUnit.unit,
      unitFamily: basisUnit.family,
      displayText: input.basis.displayText,
      equivalentWeightGrams: normalizedEquivalent(
        input.basis.equivalentWeightGrams,
      ),
      equivalentVolumeMl: normalizedEquivalent(input.basis.equivalentVolumeMl),
    },
    requestedServing: {
      quantity: servingResolution.requestedQuantity,
      unit: servingResolution.requestedUnit,
      unitFamily: servingResolution.requestedUnitFamily,
      servingOptionId: servingResolution.servingOptionId,
      selectedServingOption,
    },
    resolution: {
      status: servingResolution.status,
      reason: servingResolution.reason,
      multiplier: servingResolution.multiplier,
      resolvedWeightGrams: servingResolution.resolvedWeightGrams,
      resolvedVolumeMl: servingResolution.resolvedVolumeMl,
    },
    basisNutrition: input.basisNutrition,
    nutritionOverride: overridden.snapshot,
    provenance: input.provenance,
  };
  const parsedSnapshot =
    foodLogServingSnapshotSchema.safeParse(snapshotCandidate);
  if (!parsedSnapshot.success) throw new AuthoritativeServingInvariantError();

  return {
    ok: true,
    fullPrecisionNutrition,
    finalNutrition: overridden.nutrition,
    finalNutrients: Object.entries(overridden.nutrition.nutrients).map(
      ([nutrientKey, nutrient]) => ({
        nutrientKey: nutrientKey as NormalizedNutrientKey,
        amount: nutrient.amount,
        unit: nutrient.unit,
      }),
    ),
    servingSnapshot: parsedSnapshot.data,
    servingResolution,
  };
}
