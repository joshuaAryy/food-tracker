import { normalizeUsdaFood } from '../src/modules/foodItems/usda-fdc.js';
import { foodItemServingOptionsSchema } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';

const payload = (foodPortions: unknown) => ({
  fdcId: 1001,
  description: 'Test food',
  dataType: 'Foundation',
  foodNutrients: [],
  foodPortions,
});

describe('USDA serving options', () => {
  it('keeps explicit household and count portions as trusted weight options', () => {
    const food = normalizeUsdaFood(
      payload([
        { amount: 1, gramWeight: 50, measureUnit: { name: 'egg' } },
        { amount: 1, gramWeight: 28, measureUnit: { name: 'slice' } },
        { amount: 1, gramWeight: 158, measureUnit: { name: 'cup' } },
        { amount: 2, gramWeight: 32, measureUnit: { name: 'tbsp' } },
      ]),
    );

    expect(food?.servingOptions).toEqual({
      schemaVersion: 1,
      options: expect.arrayContaining([
        expect.objectContaining({ unit: 'egg', equivalentWeightGrams: 50 }),
        expect.objectContaining({ unit: 'slice', equivalentWeightGrams: 28 }),
        expect.objectContaining({
          unit: 'cup',
          unitFamily: 'household',
          equivalentWeightGrams: 158,
        }),
        expect.objectContaining({
          unit: 'tbsp',
          unitFamily: 'household',
          quantity: 2,
          equivalentWeightGrams: 32,
        }),
      ]),
    });
  });

  it('keeps USDA size-plus-food whole-item portions as candidate-specific medium items', () => {
    const food = normalizeUsdaFood(
      payload([
        {
          amount: 1,
          gramWeight: 182,
          measureUnit: { name: 'medium' },
          modifier: 'apple',
        },
      ]),
    );

    expect(food?.servingOptions).toMatchObject({
      schemaVersion: 1,
      options: [
        expect.objectContaining({
          label: '1 medium apple',
          unit: 'medium_item',
          equivalentWeightGrams: 182,
          source: 'provider',
          trust: 'trusted',
        }),
      ],
    });
  });

  it('normalizes USDA medium portion casing without losing the whole-item option', () => {
    const food = normalizeUsdaFood(
      payload([
        {
          amount: 1,
          gramWeight: 182,
          measureUnit: { name: 'Medium' },
          modifier: 'Apple',
        },
      ]),
    );

    const servingOptions = foodItemServingOptionsSchema.parse(
      food?.servingOptions,
    );
    expect(servingOptions.options[0]).toMatchObject({
      unit: 'medium_item',
      label: '1 Medium Apple',
      equivalentWeightGrams: 182,
    });
  });

  it('normalizes the live USDA undetermined medium portion shape', () => {
    const food = normalizeUsdaFood({
      ...payload([
        {
          gramWeight: 182,
          measureUnit: { name: 'undetermined' },
          modifier: '61238',
          portionDescription: '1 medium',
        },
      ]),
      description: 'Apple, raw',
    });

    expect(food?.servingOptions).toMatchObject({
      schemaVersion: 1,
      options: [
        expect.objectContaining({
          label: '1 medium Apple',
          unit: 'medium_item',
          equivalentWeightGrams: 182,
        }),
      ],
    });
  });

  it('normalizes trusted egg, yogurt-container, and slice portions from descriptions', () => {
    const food = normalizeUsdaFood({
      ...payload([
        {
          gramWeight: 50,
          measureUnit: { name: 'undetermined' },
          modifier: 'egg-id',
          portionDescription: '1 large egg',
        },
        {
          gramWeight: 170,
          measureUnit: { name: 'container' },
          portionDescription: '1 container',
        },
        {
          gramWeight: 28,
          measureUnit: { name: 'undetermined' },
          portionDescription: '1 slice',
        },
      ]),
      description: 'Yogurt, plain',
    });

    const servingOptions = foodItemServingOptionsSchema.parse(
      food?.servingOptions,
    );
    expect(servingOptions.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ unit: 'egg', equivalentWeightGrams: 50 }),
        expect.objectContaining({
          unit: 'serving',
          equivalentWeightGrams: 170,
          label: '1 container',
        }),
        expect.objectContaining({
          unit: 'slice',
          equivalentWeightGrams: 28,
        }),
      ]),
    );
  });

  it('discards USDA portions without a finite positive gram weight', () => {
    const food = normalizeUsdaFood(
      payload([
        {
          amount: 1,
          gramWeight: null,
          measureUnit: { name: 'egg' },
        },
        {
          amount: 1,
          gramWeight: 0,
          measureUnit: { name: 'slice' },
        },
      ]),
    );

    expect(food?.servingOptions).toBeNull();
  });

  it('discards incomplete, unclassifiable, duplicate, and canonical 100 g portions', () => {
    const food = normalizeUsdaFood(
      payload([
        { amount: 1, gramWeight: 50, measureUnit: { name: 'egg' } },
        { amount: 1, gramWeight: 50, measureUnit: { name: 'egg' } },
        { amount: 1, gramWeight: 100, measureUnit: { name: 'g' } },
        { amount: 0, gramWeight: 20, measureUnit: { name: 'slice' } },
        { amount: 1, gramWeight: 0, measureUnit: { name: 'slice' } },
        { amount: 1, gramWeight: 20, measureUnit: { name: 'mystery' } },
      ]),
    );

    expect(food?.servingOptions).toEqual({
      schemaVersion: 1,
      options: [
        expect.objectContaining({
          unit: 'egg',
          equivalentWeightGrams: 50,
          equivalentVolumeMl: null,
        }),
      ],
    });
  });
});
