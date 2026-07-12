import { describe, expect, it } from 'vitest';
import {
  aggregateRecipeIngredientSnapshots,
  createRecipeIngredientSnapshot,
} from '../src/modules/recipes/calculation.js';

const appleIngredient = createRecipeIngredientSnapshot({
  foodItem: {
    id: '00000000-0000-4000-8000-000000000010',
    name: 'Apple',
  },
  basis: {
    quantity: 1,
    unit: 'item',
    displayText: '1 apple',
    equivalentWeightGrams: 182,
    equivalentVolumeMl: null,
  },
  basisNutrition: {
    calories: 95,
    protein: 0.5,
    carbs: 25.13,
    fat: 0.31,
    fiber: 4.4,
    sugar: 18.91,
    sodium: 1,
    nutrients: { vitaminC: { amount: 8.4, unit: 'mg' } },
  },
  servingOptions: null,
  serving: { quantity: 2, unit: 'item' },
  provenance: {
    basisOrigin: 'food_item',
    foodItemId: '00000000-0000-4000-8000-000000000010',
    sourceType: 'app_owned',
    sourceProvider: null,
    sourceId: null,
    trustLevel: 'trusted',
  },
});

const oatsIngredient = createRecipeIngredientSnapshot({
  foodItem: {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Oats',
  },
  basis: {
    quantity: 100,
    unit: 'g',
    displayText: '100 g',
    equivalentWeightGrams: 100,
    equivalentVolumeMl: null,
  },
  basisNutrition: {
    calories: 389,
    protein: 16.89,
    carbs: 66.27,
    fat: 6.9,
    fiber: 10.6,
    sugar: 0.99,
    sodium: 2,
    nutrients: { vitaminC: { amount: 0.01, unit: 'mg' } },
  },
  servingOptions: null,
  serving: { quantity: 37.5, unit: 'g' },
  provenance: {
    basisOrigin: 'food_item',
    foodItemId: '00000000-0000-4000-8000-000000000011',
    sourceType: 'app_owned',
    sourceProvider: null,
    sourceId: null,
    trustLevel: 'trusted',
  },
});

describe('recipe calculation', () => {
  it('freezes count and mass ingredient servings as canonical decimal strings', () => {
    expect(appleIngredient.resolvedNutrition).toMatchObject({
      calories: '190',
      protein: '1',
      carbs: '50.26',
      nutrients: { vitaminC: { amount: '16.8', unit: 'mg' } },
    });
    expect(appleIngredient.resolution).toMatchObject({
      multiplier: '2',
      resolvedWeightGrams: null,
    });
    expect(oatsIngredient.resolvedNutrition).toMatchObject({
      calories: '145.875',
      protein: '6.33375',
      nutrients: { vitaminC: { amount: '0.00375', unit: 'mg' } },
    });
    expect(oatsIngredient.requestedServing.quantity).toBe('37.5');
  });

  it('aggregates frozen ingredients at precision then materializes totals and portions', () => {
    const result = aggregateRecipeIngredientSnapshots({
      ingredients: [appleIngredient, oatsIngredient],
      portionCount: 3,
      finalCookedWeightGrams: 600,
    });

    expect(result.total.fullPrecision).toMatchObject({
      calories: '335.875',
      protein: '7.33375',
      carbs: '75.11125',
      nutrients: { vitaminC: { amount: '16.80375', unit: 'mg' } },
    });
    expect(result.total.materialized).toMatchObject({
      calories: 336,
      protein: 7.3,
      carbs: 75.1,
      nutrients: { vitaminC: { amount: 16.8038, unit: 'mg' } },
    });
    expect(result.perPortion.fullPrecision.protein).toBe(
      '2.444583333333333333333333333333333333333',
    );
    expect(result.perGram?.fullPrecision.calories).toBe(
      '0.5597916666666666666666666666666666666667',
    );
  });

  it('does not create a per-gram calculation without final cooked weight', () => {
    const result = aggregateRecipeIngredientSnapshots({
      ingredients: [appleIngredient],
      portionCount: 2,
      finalCookedWeightGrams: null,
    });

    expect(result.perGram).toBeNull();
    expect(result.perPortion.fullPrecision.calories).toBe('95');
  });

  it('does not serialize floating-point multiplication artifacts into snapshots', () => {
    const ingredient = createRecipeIngredientSnapshot({
      foodItem: {
        id: '00000000-0000-4000-8000-000000000012',
        name: 'Precision food',
      },
      basis: {
        quantity: 100,
        unit: 'g',
        displayText: '100 g',
        equivalentWeightGrams: 100,
        equivalentVolumeMl: null,
      },
      basisNutrition: {
        calories: 1,
        protein: 0.1,
        carbs: 0.1,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrients: { vitaminC: { amount: 0.1, unit: 'mg' } },
      },
      servingOptions: null,
      serving: { quantity: 20, unit: 'g' },
      provenance: {
        basisOrigin: 'food_item',
        foodItemId: '00000000-0000-4000-8000-000000000012',
        sourceType: 'app_owned',
        sourceProvider: null,
        sourceId: null,
        trustLevel: 'trusted',
      },
    });

    expect(ingredient.resolvedNutrition).toMatchObject({
      protein: '0.02',
      carbs: '0.02',
      nutrients: { vitaminC: { amount: '0.02', unit: 'mg' } },
    });
  });

  it('keeps frozen totals unchanged when recipe metadata changes', () => {
    const original = aggregateRecipeIngredientSnapshots({
      ingredients: [appleIngredient, oatsIngredient],
      portionCount: 2,
      finalCookedWeightGrams: 500,
    });
    const renamed = aggregateRecipeIngredientSnapshots({
      ingredients: [appleIngredient, oatsIngredient],
      portionCount: 2,
      finalCookedWeightGrams: 500,
    });

    expect(renamed.total).toEqual(original.total);
  });

  it('replaces only the recalculated ingredient snapshot', () => {
    const retainedAppleSnapshot = JSON.stringify(appleIngredient);
    const updatedOats = createRecipeIngredientSnapshot({
      foodItem: oatsIngredient.foodItem,
      basis: {
        quantity: 100,
        unit: 'g',
        displayText: '100 g',
        equivalentWeightGrams: 100,
        equivalentVolumeMl: null,
      },
      basisNutrition: {
        calories: 389,
        protein: 16.89,
        carbs: 66.27,
        fat: 6.9,
        fiber: 10.6,
        sugar: 0.99,
        sodium: 2,
        nutrients: { vitaminC: { amount: 0.01, unit: 'mg' } },
      },
      servingOptions: null,
      serving: { quantity: 50, unit: 'g' },
      provenance: oatsIngredient.provenance,
    });

    expect(JSON.stringify([appleIngredient, updatedOats][0])).toBe(
      retainedAppleSnapshot,
    );
    expect(updatedOats).not.toEqual(oatsIngredient);
    expect(updatedOats.resolvedNutrition.calories).toBe('194.5');
  });
});
