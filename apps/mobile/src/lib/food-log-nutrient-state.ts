import {
  NORMALIZED_NUTRIENT_KEYS,
  type NormalizedNutrientKey,
} from '@food-tracker/shared';

type NutrientValue = {
  amount: number;
  unit: string;
};

type NutrientMap = Partial<Record<NormalizedNutrientKey, NutrientValue>>;

export type MainNutritionValues = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  sodium: string;
};

export type MainNutrition = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

type SnapshotNutrientState = {
  basisNutrition: {
    nutrients: NutrientMap;
  };
  nutritionOverride: {
    nutrients: {
      applied: boolean;
      value: NutrientMap | null;
    };
  } | null;
};

function editableValuesFromNutrients(
  nutrients: NutrientMap,
): Record<NormalizedNutrientKey, string> {
  return Object.fromEntries(
    NORMALIZED_NUTRIENT_KEYS.map((key) => {
      const nutrient = nutrients[key];
      return [key, nutrient === undefined ? '' : String(nutrient.amount)];
    }),
  ) as Record<NormalizedNutrientKey, string>;
}

function editableValuesFromMainNutrition(
  nutrition: MainNutrition,
): MainNutritionValues {
  return Object.fromEntries(
    Object.entries(nutrition).map(([key, value]) => [
      key,
      value === null ? '' : String(value),
    ]),
  ) as MainNutritionValues;
}

/**
 * Keep persisted top-level nutrition overrides visible while a serving preview
 * recalculates from the immutable basis. Once an override is explicitly
 * cleared, the preview becomes the edit source again.
 */
export function editMainNutrientValuesAfterServingPreview(
  currentValues: MainNutritionValues,
  previewNutrition: MainNutrition,
  preserveSnapshotOverride: boolean,
): MainNutritionValues {
  return preserveSnapshotOverride
    ? currentValues
    : editableValuesFromMainNutrition(previewNutrition);
}

/**
 * Return editable normalized nutrient text without collapsing explicit zero
 * into Unknown. A persisted normalized override is the current edit source;
 * otherwise the immutable serving basis is used.
 */
export function editNutrientValuesFromSnapshot(
  snapshot: SnapshotNutrientState,
): Record<NormalizedNutrientKey, string> {
  const override = snapshot.nutritionOverride;
  const nutrients =
    override?.nutrients.applied === true
      ? (override.nutrients.value ?? {})
      : snapshot.basisNutrition.nutrients;

  return editableValuesFromNutrients(nutrients);
}

/**
 * Keep a persisted normalized override visible when a serving preview
 * recalculates from the immutable basis. A cleared override must instead use
 * the preview's basis nutrients.
 */
export function editNutrientValuesAfterServingPreview(
  snapshot: SnapshotNutrientState,
  previewNutrients: NutrientMap,
  preserveSnapshotOverride: boolean,
): Record<NormalizedNutrientKey, string> {
  return preserveSnapshotOverride
    ? editNutrientValuesFromSnapshot(snapshot)
    : editableValuesFromNutrients(previewNutrients);
}
