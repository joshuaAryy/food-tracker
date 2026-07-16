import { describe, expect, it } from 'vitest';
import type {
  AiFoodParseCandidate,
  FoodItem,
  FoodLog,
  Recipe,
} from '@food-tracker/shared';
import {
  buildRecipeCreateRequest,
  buildRecipeLogRequest,
  changedIngredientMutations,
  recipeBuilderError,
  recipeLogUnits,
  recipeListItem,
  recipePresentation,
  recipeRequiresMetadataUpdate,
  isRecipeOriginFoodLog,
  refreshAfterRecipeLog,
  applyTrustedFoodCandidate,
  applyTrustedFoodSelection,
  applyRecipePickerSelection,
  cancelRecipeIngredientEditing,
  applyRecipeServingResult,
  externalCandidatePersistenceInput,
  selectTrustedFoodForEditor,
  type RecipeEditorIngredientDraft,
  type RecipeIngredientDraft,
} from '../../mobile/src/lib/recipe-ui.js';

const persistedFood = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Rice',
  brandName: null,
  sourceType: 'cached_external',
  foodType: 'generic',
  sourceProvider: 'usda_fdc',
  sourceId: 'rice-1',
  sourceUpdatedAt: null,
  isSaved: false,
  servingQuantity: 100,
  servingUnit: 'g',
  servingWeightGrams: 100,
  servingOptions: null,
  calories: 130,
  protein: 2.7,
  carbs: 28,
  fat: 0.3,
  fiber: 0.4,
  sugar: 0.1,
  sodium: 1,
  additionalNutrients: null,
  nutrients: {},
  barcodes: [],
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
} satisfies FoodItem;

const recipe = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Oats',
  description: null,
  portionCount: 2,
  finalCookedWeightGrams: 400,
  gramLoggingAvailable: true,
  ingredients: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      foodItemId: '00000000-0000-4000-8000-000000000003',
      position: 0,
      snapshot: {
        schemaVersion: 1,
        foodItem: { id: '00000000-0000-4000-8000-000000000003', name: 'Oats' },
        nutritionBasis: {
          quantity: '100',
          unit: 'g',
          unitFamily: 'mass',
          displayText: null,
          equivalentWeightGrams: '100',
          equivalentVolumeMl: null,
        },
        requestedServing: {
          quantity: '100',
          unit: 'g',
          unitFamily: 'mass',
          servingOptionId: null,
          selectedServingOption: null,
        },
        resolution: {
          status: 'exact',
          reason: 'same_basis',
          multiplier: '1',
          resolvedWeightGrams: '100',
          resolvedVolumeMl: null,
        },
        resolvedNutrition: {
          calories: '100',
          protein: '10',
          carbs: '20',
          fat: null,
          fiber: null,
          sugar: null,
          sodium: null,
          nutrients: { vitaminC: { amount: '10', unit: 'mg' } },
        },
        provenance: {
          basisOrigin: 'food_item',
          foodItemId: '00000000-0000-4000-8000-000000000003',
          sourceType: 'cached_external',
          sourceProvider: 'usda_fdc',
          sourceId: '1',
          trustLevel: 'trusted',
        },
      },
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    },
  ],
  total: {
    fullPrecision: {
      calories: '100',
      protein: '10',
      carbs: '20',
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: { vitaminC: { amount: '10', unit: 'mg' } },
    },
    materialized: {
      calories: 100,
      protein: 10,
      carbs: 20,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: { vitaminC: { amount: 10, unit: 'mg' } },
    },
  },
  perPortion: {
    fullPrecision: {
      calories: '50',
      protein: '5',
      carbs: '10',
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: { vitaminC: { amount: '5', unit: 'mg' } },
    },
    materialized: {
      calories: 50,
      protein: 5,
      carbs: 10,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: { vitaminC: { amount: 5, unit: 'mg' } },
    },
  },
  perGram: {
    fullPrecision: {
      calories: '0.25',
      protein: '0.025',
      carbs: '0.05',
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: { vitaminC: { amount: '0.025', unit: 'mg' } },
    },
    materialized: {
      calories: 0,
      protein: 0,
      carbs: 0.1,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: { vitaminC: { amount: 0.025, unit: 'mg' } },
    },
  },
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
} satisfies Recipe;

const initialIngredient = recipe.ingredients[0]!;

const validDraft: RecipeIngredientDraft = {
  key: 'draft-1',
  foodItemId: initialIngredient.foodItemId,
  amount: '100',
  unit: 'g',
  servingOptionId: null,
  servingStatus: 'ready',
  existingIngredientId: initialIngredient.id,
};

describe('mobile recipe flow helpers', () => {
  it('builds recipe API requests without client-calculated nutrition fields', () => {
    expect(
      buildRecipeCreateRequest({
        name: ' Oats ',
        description: '',
        portionCount: '2',
        cookedWeight: '',
        ingredients: [validDraft],
      }),
    ).toEqual({
      name: 'Oats',
      portionCount: 2,
      description: null,
      ingredients: [
        {
          foodItemId: validDraft.foodItemId,
          serving: { quantity: 100, unit: 'g', servingOptionId: null },
        },
      ],
    });
  });

  it('requires a valid named recipe with at least one resolved trusted ingredient', () => {
    expect(
      recipeBuilderError({
        name: '',
        portionCount: '2',
        cookedWeight: '',
        ingredients: [validDraft],
      }),
    ).toMatch(/name/i);
    expect(
      recipeBuilderError({
        name: 'Oats',
        portionCount: '2',
        cookedWeight: '',
        ingredients: [],
      }),
    ).toMatch(/ingredient/i);
    expect(
      recipeBuilderError({
        name: 'Oats',
        portionCount: '2',
        cookedWeight: '',
        ingredients: [{ ...validDraft, servingStatus: 'needs_review' }],
      }),
    ).toMatch(/serving/i);
  });

  it('keeps cooked weight optional while exposing grams only when available', () => {
    expect(recipeLogUnits(recipe)).toEqual(['portion', 'g']);
    expect(
      recipeLogUnits({
        ...recipe,
        finalCookedWeightGrams: null,
        gramLoggingAvailable: false,
      }),
    ).toEqual(['portion']);
  });

  it('maps active recipes to compact list facts supplied by the backend', () => {
    expect(recipeListItem(recipe)).toEqual({
      name: 'Oats',
      caloriesPerPortion: 50,
      portionCount: 2,
      gramLoggingAvailable: true,
    });
  });

  it('builds only valid portion and gram log requests', () => {
    expect(
      buildRecipeLogRequest(
        {
          amount: '1.5',
          unit: 'portion',
          mealType: 'breakfast',
          loggedAt: '2026-07-12T12:00:00.000Z',
          notes: '',
        },
        recipe,
      ),
    ).toEqual({
      amount: 1.5,
      unit: 'portion',
      mealType: 'breakfast',
      loggedAt: '2026-07-12T12:00:00.000Z',
      notes: null,
    });
    expect(
      buildRecipeLogRequest(
        {
          amount: '100',
          unit: 'g',
          mealType: 'dinner',
          loggedAt: '2026-07-12T12:00:00.000Z',
          notes: 'Warm',
        },
        recipe,
      ),
    ).toMatchObject({ amount: 100, unit: 'g' });
    expect(
      buildRecipeLogRequest(
        {
          amount: '100',
          unit: 'g',
          mealType: 'dinner',
          loggedAt: '2026-07-12T12:00:00.000Z',
          notes: '',
        },
        {
          ...recipe,
          finalCookedWeightGrams: null,
          gramLoggingAvailable: false,
        },
      ),
    ).toBeNull();
  });

  it('plans metadata and changed-ingredient-only mutations', () => {
    expect(
      recipeRequiresMetadataUpdate(recipe, {
        name: 'Oats',
        description: null,
        portionCount: '2',
        cookedWeight: '400',
      }),
    ).toBe(false);
    expect(
      recipeRequiresMetadataUpdate(recipe, {
        name: 'New oats',
        description: null,
        portionCount: '2',
        cookedWeight: '400',
      }),
    ).toBe(true);
    expect(changedIngredientMutations(recipe, [validDraft])).toEqual({
      add: [],
      update: [],
      remove: [],
    });
    expect(
      changedIngredientMutations(recipe, [{ ...validDraft, amount: '200' }]),
    ).toEqual({
      add: [],
      update: [
        {
          ingredientId: validDraft.existingIngredientId,
          foodItemId: validDraft.foodItemId,
          serving: { quantity: 200, unit: 'g', servingOptionId: null },
        },
      ],
      remove: [],
    });
    expect(
      changedIngredientMutations(recipe, [
        { ...validDraft, foodItemId: null, servingStatus: 'ready' },
      ]),
    ).toEqual({ add: [], update: [], remove: [] });
    expect(
      recipeBuilderError({
        name: 'Oats',
        portionCount: '2',
        cookedWeight: '',
        ingredients: [
          { ...validDraft, foodItemId: null, servingStatus: 'ready' },
        ],
      }),
    ).toBeNull();
  });

  it('presents backend nutrition by tracking mode without recomputing totals', () => {
    expect(recipePresentation(recipe, 'simple')).toEqual(
      expect.objectContaining({ calories: 50, protein: 5, nutrients: [] }),
    );
    expect(recipePresentation(recipe, 'complex')).toEqual(
      expect.objectContaining({
        calories: 50,
        protein: 5,
        nutrients: [{ key: 'vitaminC', amount: 5, unit: 'mg' }],
      }),
    );
  });

  it('identifies recipe-origin History records without changing ordinary FoodLog behavior', () => {
    const recipeLog = {
      recipeSnapshot: { schemaVersion: 2 },
    } as unknown as FoodLog;
    const ordinaryLog = { recipeSnapshot: null } as FoodLog;
    expect(isRecipeOriginFoodLog(recipeLog)).toBe(true);
    expect(isRecipeOriginFoodLog(ordinaryLog)).toBe(false);
  });

  it('signals existing food-data consumers to refresh after recipe logging', () => {
    let refreshes = 0;
    refreshAfterRecipeLog(() => {
      refreshes += 1;
    });
    expect(refreshes).toBe(1);
  });

  it('maps only persisted trusted candidates and applies the tap to builder state', () => {
    const persisted: AiFoodParseCandidate = {
      candidateType: 'food_item',
      foodItem: persistedFood,
      externalFood: null,
      rank: 1,
      matchReason: 'cached_external',
      confidence: 'high',
      defaultServingMultiplier: 1,
    };
    const external: AiFoodParseCandidate = {
      candidateType: 'external_food',
      foodItem: null,
      externalFood: {
        sourceProvider: 'usda_fdc',
        sourceId: '2708402',
        name: 'Rice, cooked',
        brandName: null,
        foodType: 'generic',
        servingBasisText: 'per 100 g',
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: 100,
        servingOptions: null,
        defaultWholeItemServing: null,
        calories: 130,
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
        fiber: 0.4,
        sugar: 0.1,
        sodium: 1,
        nutrients: {},
      },
      rank: 2,
      matchReason: 'usda_fdc',
      confidence: 'high',
      defaultServingMultiplier: 1,
    };
    expect(applyTrustedFoodCandidate(persisted)).toBe(persistedFood);
    expect(applyTrustedFoodCandidate(external)).toBeNull();
    const drafts = [
      {
        key: 'new-ingredient',
        foodItemId: null,
        amount: '',
        unit: '',
        servingOptionId: null,
        servingStatus: 'invalid' as const,
        food: null,
        label: 'Choose a trusted food',
      },
    ];
    const selected = applyTrustedFoodSelection(drafts, 0, persistedFood);
    expect(selected[0]).toMatchObject({
      foodItemId: persistedFood.id,
      food: persistedFood,
      amount: '100',
      unit: 'g',
      label: 'Rice',
    });
    expect(selectTrustedFoodForEditor(drafts, 0, persistedFood)).toMatchObject({
      activeDraftIndex: 0,
      drafts: [expect.objectContaining({ foodItemId: persistedFood.id })],
    });
  });

  it('turns a trusted USDA candidate into a persisted FoodItem request before selecting it', () => {
    const external: AiFoodParseCandidate = {
      candidateType: 'external_food',
      foodItem: null,
      externalFood: {
        sourceProvider: 'usda_fdc',
        sourceId: '2708402',
        name: 'Rice, cooked',
        brandName: null,
        foodType: 'generic',
        servingBasisText: 'per 100 g',
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: 100,
        servingOptions: null,
        defaultWholeItemServing: null,
        calories: 130,
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
        fiber: 0.4,
        sugar: 0.1,
        sodium: 1,
        nutrients: {},
      },
      rank: 1,
      matchReason: 'usda_fdc',
      confidence: 'high',
      defaultServingMultiplier: 1,
    };
    expect(externalCandidatePersistenceInput(external)).toEqual({
      sourceProvider: 'usda_fdc',
      sourceId: '2708402',
    });
    expect(
      externalCandidatePersistenceInput({
        ...external,
        externalFood: { ...external.externalFood, sourceId: '' },
      }),
    ).toBeNull();

    const drafts = [
      {
        key: 'new-ingredient',
        foodItemId: null,
        amount: '',
        unit: '',
        servingOptionId: null,
        servingStatus: 'invalid' as const,
        food: null,
        label: 'Choose a trusted food',
      },
    ];
    expect(applyRecipePickerSelection(drafts, 0, persistedFood)).toMatchObject({
      activeDraftIndex: 0,
      drafts: [expect.objectContaining({ foodItemId: persistedFood.id })],
    });
    expect(applyRecipePickerSelection(drafts, null, persistedFood)).toBeNull();
    const selectedDraft = applyTrustedFoodSelection(
      drafts,
      0,
      persistedFood,
    )[0];
    expect(
      cancelRecipeIngredientEditing([selectedDraft!], 0, drafts[0]!),
    ).toEqual([]);
    const existingEditorDraft: RecipeEditorIngredientDraft = {
      ...validDraft,
      food: persistedFood,
      label: 'Rice',
    };
    expect(
      cancelRecipeIngredientEditing(
        [{ ...existingEditorDraft, amount: '250' }],
        0,
        existingEditorDraft,
      ),
    ).toEqual([existingEditorDraft]);

    expect(
      applyRecipeServingResult([drafts[0]!], 0, {
        operation: 'add',
        draft: { ...selectedDraft!, amount: '250', unit: 'g' },
      }),
    ).toMatchObject([{ foodItemId: persistedFood.id, amount: '250' }]);
    expect(
      applyRecipeServingResult([existingEditorDraft], 0, {
        operation: 'edit',
        draft: { ...existingEditorDraft, amount: '400', unit: 'g' },
      }),
    ).toMatchObject([{ amount: '400' }]);
    expect(
      applyRecipeServingResult([selectedDraft!], 0, {
        operation: 'add',
        draft: null,
      }),
    ).toEqual([]);
  });
});
