import {
  PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_KCAL,
  PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_RATIO,
  PHOTO_NUTRITION_ESTIMATE_MAX_CALORIES,
  PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS,
  type PhotoNutritionEstimate,
  type PhotoNutritionEstimateBasis,
} from '@food-tracker/shared';

export interface PhotoNutritionEstimateValues {
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  confidence: 'low' | 'medium';
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

export function validatePhotoNutritionEstimate(
  value: PhotoNutritionEstimateValues,
): PhotoNutritionEstimateValues | null {
  const values = [
    value.calories,
    value.proteinGrams,
    value.carbohydrateGrams,
    value.fatGrams,
  ];
  if (!values.every(finite)) return null;
  if (
    value.calories <= 0 ||
    Math.round(value.calories) < 1 ||
    value.calories > PHOTO_NUTRITION_ESTIMATE_MAX_CALORIES ||
    value.proteinGrams < 0 ||
    value.carbohydrateGrams < 0 ||
    value.fatGrams < 0 ||
    value.proteinGrams > PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS ||
    value.carbohydrateGrams > PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS ||
    value.fatGrams > PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS
  ) {
    return null;
  }

  const macroEnergy =
    value.proteinGrams * 4 + value.carbohydrateGrams * 4 + value.fatGrams * 9;
  const tolerance = Math.max(
    PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_KCAL,
    macroEnergy * PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_RATIO,
  );
  if (Math.abs(value.calories - macroEnergy) > tolerance) return null;
  return value;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function buildPhotoNutritionEstimate(
  value: PhotoNutritionEstimateValues,
  basis: PhotoNutritionEstimateBasis,
  quantityLabel: string | null,
): PhotoNutritionEstimate {
  return {
    calories: Math.round(value.calories),
    proteinGrams: round(value.proteinGrams, 1),
    carbohydrateGrams: round(value.carbohydrateGrams, 1),
    fatGrams: round(value.fatGrams, 1),
    confidence: value.confidence,
    basis,
    source: 'ai_estimate',
    trust: 'low',
    editable: true,
    linkedFoodItemId: null,
    label:
      basis === 'structured_quantity' && quantityLabel !== null
        ? `Estimated for ${quantityLabel}`
        : 'Estimated for portion shown',
  };
}
