import type {
  FoodItem,
  MealType,
  MixedMealCreateInput,
  MixedMealPreviewInput,
  MixedMealPreviewResult,
} from '@food-tracker/shared';
import type { RecipeServingResult } from './recipe-ui';

export type MixedMealIngredientDraft = {
  key: string;
  foodItemId: string;
  food: FoodItem;
  amount: string;
  unit: string;
  servingOptionId: string | null;
  servingStatus: 'ready' | 'invalid' | 'needs_review';
};

export type MixedMealDraft = {
  name: string;
  mealType: MealType;
  loggedAt: string;
  notes: string;
  ingredients: MixedMealIngredientDraft[];
  saveAsRecipe: boolean;
  recipeName: string;
  recipeDescription: string;
  portionCount: string;
  cookedWeight: string;
};

function positive(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function integer(value: string): number | null {
  const parsed = positive(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

export function mixedMealValidation(draft: MixedMealDraft): string | null {
  if (draft.name.trim() === '') return 'Meal name is required.';
  if (draft.ingredients.length === 0) return 'Add at least one ingredient.';
  if (
    draft.ingredients.some(
      (item) =>
        positive(item.amount) === null ||
        item.unit.trim() === '' ||
        item.servingStatus !== 'ready',
    )
  ) {
    return 'Correct each ingredient serving before continuing.';
  }
  if (draft.saveAsRecipe) {
    if (integer(draft.portionCount) === null)
      return 'Portion count must be a positive whole number.';
    if (
      draft.cookedWeight.trim() !== '' &&
      positive(draft.cookedWeight) === null
    )
      return 'Cooked weight must be positive when provided.';
  }
  return null;
}

export function mixedMealPreviewRequest(
  draft: MixedMealDraft,
): MixedMealPreviewInput | null {
  if (draft.name.trim() === '' || draft.ingredients.length === 0) return null;
  const items = draft.ingredients.map((item) => {
    const quantity = positive(item.amount);
    return quantity === null ||
      item.unit.trim() === '' ||
      item.servingStatus !== 'ready'
      ? null
      : {
          foodItemId: item.foodItemId,
          serving: {
            quantity,
            unit: item.unit,
            servingOptionId: item.servingOptionId,
          },
        };
  });
  if (items.some((item) => item === null)) return null;
  return {
    name: draft.name.trim(),
    items: items as MixedMealPreviewInput['items'],
  };
}

export function mixedMealCreateRequest(
  draft: MixedMealDraft,
): MixedMealCreateInput | null {
  const error = mixedMealValidation(draft);
  if (error !== null) return null;
  const preview = mixedMealPreviewRequest(draft);
  if (preview === null) return null;
  const result: MixedMealCreateInput = {
    ...preview,
    mealType: draft.mealType,
    loggedAt: draft.loggedAt,
    notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
  };
  if (draft.saveAsRecipe) {
    result.saveAsRecipe = {
      name: draft.recipeName.trim() || draft.name.trim(),
      description:
        draft.recipeDescription.trim() === ''
          ? null
          : draft.recipeDescription.trim(),
      portionCount: integer(draft.portionCount) ?? 1,
      finalCookedWeightGrams:
        draft.cookedWeight.trim() === '' ? null : positive(draft.cookedWeight),
    };
  }
  return result;
}

export function applyMixedMealServingResult(
  ingredients: MixedMealIngredientDraft[],
  index: number,
  result: RecipeServingResult,
): MixedMealIngredientDraft[] {
  if (result.draft === null)
    return result.operation === 'add'
      ? ingredients.filter((_, itemIndex) => itemIndex !== index)
      : ingredients;
  const draft = result.draft;
  if (draft.food === null || draft.foodItemId === null) return ingredients;
  const item: MixedMealIngredientDraft = {
    key: draft.key,
    foodItemId: draft.foodItemId,
    food: draft.food,
    amount: draft.amount,
    unit: draft.unit,
    servingOptionId: draft.servingOptionId,
    servingStatus: draft.servingStatus,
  };
  return result.operation === 'add' && index >= ingredients.length
    ? [...ingredients, item]
    : ingredients.map((current, itemIndex) =>
        itemIndex === index ? item : current,
      );
}

export function mixedMealDisplayTotals(
  preview: MixedMealPreviewResult | null,
  mode: 'simple' | 'complex',
) {
  if (preview === null) return null;
  const nutrition = preview.total.materialized;
  return {
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    fiber: mode === 'complex' ? nutrition.fiber : null,
    sugar: mode === 'complex' ? nutrition.sugar : null,
    sodium: mode === 'complex' ? nutrition.sodium : null,
    nutrients: mode === 'complex' ? nutrition.nutrients : {},
  };
}

export function refreshAfterMixedMeal(markDataChanged: () => void): void {
  markDataChanged();
}
