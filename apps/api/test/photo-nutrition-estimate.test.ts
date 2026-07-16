import { describe, expect, it } from 'vitest';
import {
  buildPhotoNutritionEstimate,
  validatePhotoNutritionEstimate,
} from '../src/modules/ai/photo-nutrition-estimate.js';

describe('photo nutrition estimate validation', () => {
  it('rounds a valid structured-quantity estimate into a low-trust editable contract', () => {
    const estimate = validatePhotoNutritionEstimate({
      calories: 460.4,
      proteinGrams: 15.26,
      carbohydrateGrams: 76.14,
      fatGrams: 10.95,
      confidence: 'medium',
    });

    expect(estimate).not.toBeNull();
    expect(
      buildPhotoNutritionEstimate(
        estimate!,
        'structured_quantity',
        'approximately 1.5 cups',
      ),
    ).toEqual({
      calories: 460,
      proteinGrams: 15.3,
      carbohydrateGrams: 76.1,
      fatGrams: 11,
      confidence: 'medium',
      basis: 'structured_quantity',
      source: 'ai_estimate',
      trust: 'low',
      editable: true,
      linkedFoodItemId: null,
      label: 'Estimated for approximately 1.5 cups',
    });
  });

  it('uses a portion-shown label without inventing a serving basis', () => {
    const estimate = validatePhotoNutritionEstimate({
      calories: 300,
      proteinGrams: 12,
      carbohydrateGrams: 35,
      fatGrams: 10,
      confidence: 'low',
    });

    expect(
      buildPhotoNutritionEstimate(estimate!, 'portion_shown', null).label,
    ).toBe('Estimated for portion shown');
  });

  it.each([
    { name: 'negative calories', value: { calories: -1 } },
    { name: 'negative macro', value: { proteinGrams: -1 } },
    { name: 'NaN', value: { calories: Number.NaN } },
    { name: 'infinity', value: { fatGrams: Number.POSITIVE_INFINITY } },
    { name: 'implausible calories', value: { calories: 5001 } },
    {
      name: 'energy contradiction',
      value: {
        calories: 50,
        proteinGrams: 100,
        carbohydrateGrams: 100,
        fatGrams: 100,
      },
    },
  ])('rejects $name', ({ value }) => {
    expect(
      validatePhotoNutritionEstimate({
        calories: 460,
        proteinGrams: 15,
        carbohydrateGrams: 76,
        fatGrams: 11,
        confidence: 'low',
        ...value,
      }),
    ).toBeNull();
  });
});
