import { describe, expect, it } from 'vitest';
import type { FoodItem } from '@food-tracker/shared';
import {
  defaultServingDraft,
  libraryPresentation,
} from '../../mobile/src/lib/food-library-ui.js';

const food = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Rice',
  brandName: null,
  sourceType: 'cached_external',
  foodType: 'generic',
  sourceProvider: 'usda_fdc',
  sourceId: '1',
  sourceUpdatedAt: null,
  isSaved: true,
  defaultServing: { quantity: 250, unit: 'g', servingOptionId: null },
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

describe('mobile food library helpers', () => {
  it('uses a stored default serving as a prefill without nutrition fields', () => {
    expect(defaultServingDraft(food)).toEqual({
      amount: '250',
      unit: 'g',
      servingOptionId: null,
    });
    expect(JSON.stringify(defaultServingDraft(food))).not.toContain('calories');
  });

  it('keeps ownership actions unavailable for a cached food and presents detailed unknowns as unknown', () => {
    expect(libraryPresentation(food, false, 'complex')).toMatchObject({
      canEdit: false,
      canArchive: false,
      calories: 130,
      fiber: null,
    });
  });
});
