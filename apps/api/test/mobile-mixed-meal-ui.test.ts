import { describe, expect, it } from 'vitest';
import type { FoodItem } from '@food-tracker/shared';
import {
  applyMixedMealServingResult,
  mixedMealCreateRequest,
  mixedMealDisplayTotals,
  mixedMealPreviewRequest,
  mixedMealValidation,
  type MixedMealDraft,
} from '../../mobile/src/lib/mixed-meal-ui.js';

const food = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Rice',
  brandName: null,
  sourceType: 'user_custom',
  foodType: 'generic',
  sourceProvider: 'manual',
  sourceId: null,
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
  fiber: null,
  sugar: null,
  sodium: null,
  additionalNutrients: null,
  nutrients: {},
  barcodes: [],
  createdAt: '',
  updatedAt: '',
} satisfies FoodItem;
const draft = (overrides: Partial<MixedMealDraft> = {}): MixedMealDraft => ({
  name: 'Rice bowl',
  mealType: 'lunch',
  loggedAt: '2026-07-12T18:00:00.000Z',
  notes: '',
  ingredients: [
    {
      key: 'one',
      foodItemId: food.id,
      food,
      amount: '250',
      unit: 'g',
      servingOptionId: null,
      servingStatus: 'ready',
    },
  ],
  saveAsRecipe: false,
  recipeName: '',
  recipeDescription: '',
  portionCount: '1',
  cookedWeight: '',
  ...overrides,
});

describe('mobile mixed meal flow helpers', () => {
  it('builds preview and log requests with only IDs and requested servings', () => {
    const input = mixedMealCreateRequest(draft());
    expect(input).toEqual({
      name: 'Rice bowl',
      description: undefined,
      items: [
        {
          foodItemId: food.id,
          serving: { quantity: 250, unit: 'g', servingOptionId: null },
        },
      ],
      mealType: 'lunch',
      loggedAt: '2026-07-12T18:00:00.000Z',
      notes: null,
    });
    expect(JSON.stringify(input)).not.toContain('calories');
    expect(JSON.stringify(input)).not.toContain('servingMultiplier');
    expect(mixedMealPreviewRequest(draft())).toMatchObject({
      items: [{ foodItemId: food.id }],
    });
  });

  it('keeps save-as-recipe off by default and includes opted-in metadata', () => {
    expect(mixedMealCreateRequest(draft())).not.toHaveProperty('saveAsRecipe');
    expect(
      mixedMealCreateRequest(
        draft({
          saveAsRecipe: true,
          recipeName: '',
          portionCount: '2',
          cookedWeight: '500',
        }),
      ),
    ).toMatchObject({
      saveAsRecipe: {
        name: 'Rice bowl',
        portionCount: 2,
        finalCookedWeightGrams: 500,
      },
    });
  });

  it('blocks invalid servings and exposes backend totals without recalculating', () => {
    expect(
      mixedMealValidation(
        draft({
          ingredients: [
            { ...draft().ingredients[0]!, servingStatus: 'needs_review' },
          ],
        }),
      ),
    ).toContain('Correct');
    expect(
      mixedMealDisplayTotals(
        {
          total: {
            materialized: {
              calories: 321,
              protein: 12.3,
              carbs: null,
              fat: null,
              fiber: null,
              sugar: null,
              sodium: null,
              nutrients: {},
            },
            fullPrecision: {} as never,
          },
          perPortion: {} as never,
          perGram: null,
          name: 'Bowl',
          description: null,
          ingredients: [],
        },
        'simple',
      ),
    ).toMatchObject({ calories: 321, protein: 12.3 });
  });

  it('cancels new servings without adding and preserves stable duplicate order', () => {
    const current = draft().ingredients;
    expect(
      applyMixedMealServingResult(current, 1, {
        operation: 'add',
        draft: null,
      }),
    ).toEqual(current);
    const added = applyMixedMealServingResult(current, 1, {
      operation: 'add',
      draft: {
        key: 'two',
        foodItemId: food.id,
        food,
        label: food.name,
        amount: '1',
        unit: 'serving',
        servingOptionId: null,
        servingStatus: 'ready',
      },
    });
    expect(added.map((item) => item.key)).toEqual(['one', 'two']);
    expect(
      applyMixedMealServingResult(added, 0, {
        operation: 'edit',
        draft: null,
      })[0]?.key,
    ).toBe('one');
  });
});
