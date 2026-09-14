import { describe, expect, it } from 'vitest';
import * as foodLibraryUi from './food-library-ui';

describe('Food Library reuse eligibility', () => {
  it('does not offer My Foods for an unoverridden provider FoodLog', () => {
    const canSave = (
      foodLibraryUi as typeof foodLibraryUi & {
        canSaveFoodLogToMyFoods?: (food: unknown) => boolean;
      }
    ).canSaveFoodLogToMyFoods;

    expect(canSave).toBeTypeOf('function');
    expect(
      canSave?.({
        recipeSnapshot: null,
        mixedMealSnapshot: null,
        servingSnapshot: {
          provenance: {
            basisOrigin: 'food_item',
            sourceType: 'cached_external',
            sourceProvider: 'usda_fdc',
          },
          nutritionOverride: null,
        },
      }),
    ).toBe(false);
  });
});
