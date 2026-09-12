import {
  NORMALIZED_NUTRIENT_KEYS,
  type NormalizedNutrientKey,
} from '@food-tracker/shared';

type NutrientValue = {
  amount: number;
  unit: string;
};

type SnapshotNutrientState = {
  basisNutrition: {
    nutrients: Partial<Record<NormalizedNutrientKey, NutrientValue>>;
  };
  nutritionOverride: {
    nutrients: {
      applied: boolean;
      value: Partial<Record<NormalizedNutrientKey, NutrientValue>> | null;
    };
  } | null;
};

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

  return Object.fromEntries(
    NORMALIZED_NUTRIENT_KEYS.map((key) => {
      const nutrient = nutrients[key];
      return [key, nutrient === undefined ? '' : String(nutrient.amount)];
    }),
  ) as Record<NormalizedNutrientKey, string>;
}
