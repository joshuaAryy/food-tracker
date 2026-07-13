import type { FoodItem, TrackingMode } from '@food-tracker/shared';

export type ServingDraftPrefill = {
  amount: string;
  unit: string;
  servingOptionId: string | null;
};

export function defaultServingDraft(food: FoodItem): ServingDraftPrefill {
  const serving = food.defaultServing;
  return {
    amount: String(serving?.quantity ?? food.servingQuantity ?? ''),
    unit: serving?.unit ?? food.servingUnit ?? '',
    servingOptionId: serving?.servingOptionId ?? null,
  };
}

export function libraryPresentation(
  food: FoodItem,
  archived: boolean,
  mode: TrackingMode,
) {
  const manual =
    food.sourceType === 'user_custom' && food.sourceProvider === 'manual';
  return {
    canEdit: manual && !archived,
    canArchive: manual && !archived,
    canRestore: manual && archived,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: mode === 'complex' ? food.fiber : null,
    sugar: mode === 'complex' ? food.sugar : null,
    sodium: mode === 'complex' ? food.sodium : null,
    nutrients: mode === 'complex' ? food.nutrients : {},
  };
}
