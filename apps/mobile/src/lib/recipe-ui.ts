import type {
  AiFoodParseCandidate,
  FoodItem,
  FoodItemExternalCandidateInput,
  FoodLog,
  MealType,
  Recipe,
  RecipeCreateInput,
  RecipeIngredientInput,
  RecipeLogInput,
  RecipeUpdateInput,
  TrackingMode,
} from '@food-tracker/shared';
import {
  provisionalServingPreview,
  type ProvisionalServingPreview,
  type ServingPreviewBasis,
} from './serving-preview';
import { defaultServingDraft } from './food-library-ui';

export type RecipeIngredientDraft = {
  key: string;
  foodItemId: string | null;
  amount: string;
  unit: string;
  servingOptionId: string | null;
  servingStatus: 'ready' | 'invalid' | 'needs_review';
  existingIngredientId?: string;
};

export type RecipeEditorIngredientDraft = RecipeIngredientDraft & {
  food: FoodItem | null;
  label: string;
};

export function recipeServingBasis(food: FoodItem): ServingPreviewBasis {
  return {
    name: food.name,
    servingQuantity: food.servingQuantity,
    servingUnit: food.servingUnit,
    nutrition: {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      sugar: food.sugar,
      sodium: food.sodium,
      nutrients: food.nutrients,
    },
    servingOptions: food.servingOptions,
  };
}

export function recipeServingPreview(
  draft: RecipeEditorIngredientDraft,
): ProvisionalServingPreview | null {
  if (draft.food === null) return null;
  return provisionalServingPreview({
    basis: recipeServingBasis(draft.food),
    request: {
      quantityText: draft.amount,
      unit: draft.unit,
      servingOptionId: draft.servingOptionId,
    },
  });
}

/** Only persisted FoodItem candidates are valid recipe ingredients. */
export function applyTrustedFoodCandidate(
  candidate: AiFoodParseCandidate,
): FoodItem | null {
  return candidate.candidateType === 'food_item' ? candidate.foodItem : null;
}

export function externalCandidatePersistenceInput(
  candidate: AiFoodParseCandidate,
): FoodItemExternalCandidateInput | null {
  if (
    candidate.candidateType !== 'external_food' ||
    candidate.externalFood.sourceId.trim() === ''
  ) {
    return null;
  }
  return {
    sourceProvider: candidate.externalFood.sourceProvider,
    sourceId: candidate.externalFood.sourceId.trim(),
  };
}

export function applyTrustedFoodSelection(
  drafts: RecipeEditorIngredientDraft[],
  index: number,
  food: FoodItem,
): RecipeEditorIngredientDraft[] {
  const serving = defaultServingDraft(food);
  return drafts.map((draft, draftIndex) => {
    if (draftIndex !== index) return draft;
    return {
      ...draft,
      foodItemId: food.id,
      amount: serving.amount,
      unit: serving.unit,
      servingOptionId: serving.servingOptionId,
      servingStatus: 'invalid',
      food,
      label: food.name,
    };
  });
}

export function selectTrustedFoodForEditor(
  drafts: RecipeEditorIngredientDraft[],
  index: number,
  food: FoodItem,
): { drafts: RecipeEditorIngredientDraft[]; activeDraftIndex: number } {
  return {
    drafts: applyTrustedFoodSelection(drafts, index, food),
    activeDraftIndex: index,
  };
}

export function applyRecipePickerSelection(
  drafts: RecipeEditorIngredientDraft[],
  activeDraftIndex: number | null,
  food: FoodItem,
): { drafts: RecipeEditorIngredientDraft[]; activeDraftIndex: number } | null {
  if (activeDraftIndex === null) return null;
  return selectTrustedFoodForEditor(drafts, activeDraftIndex, food);
}

export function cancelRecipeIngredientEditing(
  drafts: RecipeEditorIngredientDraft[],
  activeDraftIndex: number,
  originalDraft: RecipeEditorIngredientDraft | null,
): RecipeEditorIngredientDraft[] {
  const current = drafts[activeDraftIndex];
  if (current === undefined) return drafts;
  if (
    originalDraft === null ||
    originalDraft.existingIngredientId === undefined
  ) {
    return drafts.filter((_, index) => index !== activeDraftIndex);
  }
  return drafts.map((draft, index) =>
    index === activeDraftIndex ? originalDraft : draft,
  );
}

export type RecipeServingOperation = 'add' | 'edit';

export type RecipeServingResult = {
  operation: RecipeServingOperation;
  draft: RecipeEditorIngredientDraft | null;
};

export function applyRecipeServingResult(
  drafts: RecipeEditorIngredientDraft[],
  index: number,
  result: RecipeServingResult,
): RecipeEditorIngredientDraft[] {
  if (result.draft === null) {
    return result.operation === 'add'
      ? drafts.filter((_, draftIndex) => draftIndex !== index)
      : drafts;
  }
  if (result.operation === 'add' && index >= drafts.length) {
    return [...drafts, result.draft];
  }
  return drafts.map((draft, draftIndex) =>
    draftIndex === index ? result.draft! : draft,
  );
}

export type RecipeBuilderValues = {
  name: string;
  description: string | null;
  portionCount: string;
  cookedWeight: string;
};

type RecipeBuilderValidationInput = Pick<
  RecipeBuilderValues,
  'name' | 'portionCount' | 'cookedWeight'
> & {
  ingredients: RecipeIngredientDraft[];
};

type RecipeLogValues = {
  amount: string;
  unit: 'portion' | 'g';
  mealType: MealType;
  loggedAt: string;
  notes: string;
};

function positiveNumber(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function positiveInteger(value: string): number | null {
  const number = positiveNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function ingredientInput(
  draft: RecipeIngredientDraft,
): RecipeIngredientInput | null {
  const quantity = positiveNumber(draft.amount);
  if (
    draft.foodItemId === null ||
    quantity === null ||
    draft.unit.trim() === '' ||
    draft.servingStatus !== 'ready'
  ) {
    return null;
  }
  return {
    foodItemId: draft.foodItemId,
    serving: {
      quantity,
      unit: draft.unit,
      servingOptionId: draft.servingOptionId,
    },
  };
}

function retainsUnavailableFrozenIngredient(
  draft: RecipeIngredientDraft,
): boolean {
  return (
    draft.existingIngredientId !== undefined &&
    draft.foodItemId === null &&
    draft.servingStatus === 'ready'
  );
}

export function recipeBuilderError(
  input: RecipeBuilderValidationInput,
): string | null {
  if (input.name.trim() === '') return 'Recipe name is required.';
  if (positiveInteger(input.portionCount) === null) {
    return 'Portion count must be a positive whole number.';
  }
  if (
    input.cookedWeight.trim() !== '' &&
    positiveNumber(input.cookedWeight) === null
  ) {
    return 'Cooked weight must be a positive number when provided.';
  }
  if (input.ingredients.length === 0) {
    return 'Add at least one trusted food ingredient.';
  }
  if (
    input.ingredients.some(
      (ingredient) =>
        ingredientInput(ingredient) === null &&
        !retainsUnavailableFrozenIngredient(ingredient),
    )
  ) {
    return 'Correct each ingredient serving before saving this recipe.';
  }
  return null;
}

export function buildRecipeCreateRequest(
  input: RecipeBuilderValues & { ingredients: RecipeIngredientDraft[] },
): RecipeCreateInput | null {
  if (recipeBuilderError(input) !== null) return null;
  const ingredients = input.ingredients.map(ingredientInput);
  if (ingredients.some((ingredient) => ingredient === null)) return null;
  return {
    name: input.name.trim(),
    description:
      input.description === null || input.description.trim() === ''
        ? null
        : input.description.trim(),
    portionCount: positiveInteger(input.portionCount)!,
    ...(input.cookedWeight.trim() === ''
      ? {}
      : { finalCookedWeightGrams: positiveNumber(input.cookedWeight)! }),
    ingredients: ingredients as RecipeIngredientInput[],
  };
}

export function recipeRequiresMetadataUpdate(
  recipe: Recipe,
  values: RecipeBuilderValues,
): boolean {
  const description =
    values.description === null || values.description.trim() === ''
      ? null
      : values.description.trim();
  const portionCount = positiveInteger(values.portionCount);
  const cookedWeight =
    values.cookedWeight.trim() === ''
      ? null
      : positiveNumber(values.cookedWeight);
  return (
    recipe.name !== values.name.trim() ||
    recipe.description !== description ||
    recipe.portionCount !== portionCount ||
    recipe.finalCookedWeightGrams !== cookedWeight
  );
}

export function buildRecipeMetadataUpdate(
  values: RecipeBuilderValues,
): RecipeUpdateInput | null {
  if (
    values.name.trim() === '' ||
    positiveInteger(values.portionCount) === null ||
    (values.cookedWeight.trim() !== '' &&
      positiveNumber(values.cookedWeight) === null)
  ) {
    return null;
  }
  return {
    name: values.name.trim(),
    description:
      values.description === null || values.description.trim() === ''
        ? null
        : values.description.trim(),
    portionCount: positiveInteger(values.portionCount)!,
    finalCookedWeightGrams:
      values.cookedWeight.trim() === ''
        ? null
        : positiveNumber(values.cookedWeight)!,
  };
}

export function changedIngredientMutations(
  recipe: Recipe,
  drafts: RecipeIngredientDraft[],
): {
  add: RecipeIngredientInput[];
  update: Array<RecipeIngredientInput & { ingredientId: string }>;
  remove: string[];
} {
  const existingById = new Map(
    recipe.ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const retained = new Set<string>();
  const add: RecipeIngredientInput[] = [];
  const update: Array<RecipeIngredientInput & { ingredientId: string }> = [];

  for (const draft of drafts) {
    if (draft.existingIngredientId !== undefined) {
      retained.add(draft.existingIngredientId);
    }
    const input = ingredientInput(draft);
    if (input === null) continue;
    if (draft.existingIngredientId === undefined) {
      add.push(input);
      continue;
    }
    const existing = existingById.get(draft.existingIngredientId);
    if (existing === undefined) continue;
    const requested = existing.snapshot.requestedServing;
    if (
      existing.foodItemId !== input.foodItemId ||
      Number(requested.quantity) !== input.serving.quantity ||
      requested.unit !== input.serving.unit ||
      requested.servingOptionId !== input.serving.servingOptionId
    ) {
      update.push({ ingredientId: existing.id, ...input });
    }
  }
  return {
    add,
    update,
    remove: recipe.ingredients
      .filter((ingredient) => !retained.has(ingredient.id))
      .map((ingredient) => ingredient.id),
  };
}

export function recipeLogUnits(recipe: Recipe): Array<'portion' | 'g'> {
  return recipe.finalCookedWeightGrams === null
    ? ['portion']
    : ['portion', 'g'];
}

export function buildRecipeLogRequest(
  input: RecipeLogValues,
  recipe: Recipe,
): RecipeLogInput | null {
  const amount = positiveNumber(input.amount);
  if (
    amount === null ||
    (input.unit === 'g' && recipe.finalCookedWeightGrams === null)
  ) {
    return null;
  }
  return {
    amount,
    unit: input.unit,
    mealType: input.mealType,
    loggedAt: input.loggedAt,
    notes: input.notes.trim() === '' ? null : input.notes.trim(),
  };
}

export function recipePresentation(
  recipe: Recipe,
  mode: TrackingMode,
): {
  calories: number;
  protein: number;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  nutrients: Array<{ key: string; amount: number; unit: string }>;
} {
  const nutrition = recipe.perPortion.materialized;
  return {
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    fiber: nutrition.fiber,
    sugar: nutrition.sugar,
    sodium: nutrition.sodium,
    nutrients:
      mode === 'simple'
        ? []
        : Object.entries(nutrition.nutrients)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nutrient]) => ({
              key,
              amount: nutrient.amount,
              unit: nutrient.unit,
            })),
  };
}

export function recipeListItem(recipe: Recipe): {
  name: string;
  caloriesPerPortion: number;
  portionCount: number;
  gramLoggingAvailable: boolean;
} {
  return {
    name: recipe.name,
    caloriesPerPortion: recipe.perPortion.materialized.calories,
    portionCount: recipe.portionCount,
    gramLoggingAvailable: recipe.finalCookedWeightGrams !== null,
  };
}

export function isRecipeOriginFoodLog(foodLog: FoodLog): boolean {
  return foodLog.recipeSnapshot !== null;
}

export function refreshAfterRecipeLog(markDataChanged: () => void): void {
  markDataChanged();
}
