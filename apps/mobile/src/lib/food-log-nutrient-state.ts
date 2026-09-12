import {
  NORMALIZED_NUTRIENT_KEYS,
  type NormalizedNutrientKey,
} from '@food-tracker/shared';

type NutrientValue = {
  amount: number;
  unit: string;
};

type NutrientMap = Partial<Record<NormalizedNutrientKey, NutrientValue>>;

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
