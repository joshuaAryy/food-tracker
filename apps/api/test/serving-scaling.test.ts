import {
  areServingUnitsDirectlyCompatible,
  calculateServingMultiplier,
  classifyServingUnit,
  roundServingNutritionForStorage,
  roundServingWeightForDisplay,
  scaleNutritionAtFullPrecision,
  validateServingQuantity,
  type ScalableNutrition,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';

const basisNutrition: ScalableNutrition = {
  calories: 500,
  protein: 30,
  carbs: 40,
  fat: 20,
  fiber: 10,
  sugar: 12,
  sodium: 500,
  nutrients: {
    potassium: { amount: 320.1234, unit: 'mg' },
    vitaminC: { amount: 12.3456, unit: 'mg' },
    vitaminD: { amount: 1.23456, unit: 'mcg' },
  },
};

function multiplier(requestedQuantity: number, basisQuantity: number): number {
  const result = calculateServingMultiplier({
    requestedQuantity,
    basisQuantity,
    directlyCompatible: true,
  });

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.multiplier;
}

describe('serving and nutrition scaling', () => {
  it('doubles every column-backed and normalized nutrient from 100 g to 200 g', () => {
    const scaled = scaleNutritionAtFullPrecision(
      basisNutrition,
      multiplier(200, 100),
    );

    expect(scaled).toEqual({
      calories: 1000,
      protein: 60,
      carbs: 80,
      fat: 40,
      fiber: 20,
      sugar: 24,
      sodium: 1000,
      nutrients: {
        potassium: { amount: 640.2468, unit: 'mg' },
        vitaminC: { amount: 24.6912, unit: 'mg' },
        vitaminD: { amount: 2.46912, unit: 'mcg' },
      },
    });
  });

  it('halves every column-backed and normalized nutrient from 100 g to 50 g', () => {
    const scaled = scaleNutritionAtFullPrecision(
      basisNutrition,
      multiplier(50, 100),
    );

    expect(scaled).toEqual({
      calories: 250,
      protein: 15,
      carbs: 20,
      fat: 10,
      fiber: 5,
      sugar: 6,
      sodium: 250,
      nutrients: {
        potassium: { amount: 160.0617, unit: 'mg' },
        vitaminC: { amount: 6.1728, unit: 'mg' },
        vitaminD: { amount: 0.61728, unit: 'mcg' },
      },
    });
  });

  it('doubles every nutrient from a compatible 250 mL basis to 500 mL', () => {
    expect(areServingUnitsDirectlyCompatible('mL', 'ml')).toBe(true);
    expect(
      scaleNutritionAtFullPrecision(basisNutrition, multiplier(500, 250)),
    ).toEqual({
      calories: 1000,
      protein: 60,
      carbs: 80,
      fat: 40,
      fiber: 20,
      sugar: 24,
      sodium: 1000,
      nutrients: {
        potassium: { amount: 640.2468, unit: 'mg' },
        vitaminC: { amount: 24.6912, unit: 'mg' },
        vitaminD: { amount: 2.46912, unit: 'mcg' },
      },
    });
  });

  it('doubles every nutrient from one serving to two servings', () => {
    expect(areServingUnitsDirectlyCompatible('serving', 'servings')).toBe(true);
    expect(
      scaleNutritionAtFullPrecision(basisNutrition, multiplier(2, 1)),
    ).toEqual({
      calories: 1000,
      protein: 60,
      carbs: 80,
      fat: 40,
      fiber: 20,
      sugar: 24,
      sodium: 1000,
      nutrients: {
        potassium: { amount: 640.2468, unit: 'mg' },
        vitaminC: { amount: 24.6912, unit: 'mg' },
        vitaminD: { amount: 2.46912, unit: 'mcg' },
      },
    });
  });

  it('halves every nutrient from one item to half an item', () => {
    expect(areServingUnitsDirectlyCompatible('item', 'items')).toBe(true);
    expect(
      scaleNutritionAtFullPrecision(basisNutrition, multiplier(0.5, 1)),
    ).toEqual({
      calories: 250,
      protein: 15,
      carbs: 20,
      fat: 10,
      fiber: 5,
      sugar: 6,
      sodium: 250,
      nutrients: {
        potassium: { amount: 160.0617, unit: 'mg' },
        vitaminC: { amount: 6.1728, unit: 'mg' },
        vitaminD: { amount: 0.61728, unit: 'mcg' },
      },
    });
  });

  it('uses the identical multiplier for every normalized nutrient and preserves units', () => {
    const scaled = scaleNutritionAtFullPrecision(basisNutrition, 1.5);

    expect(scaled.nutrients.potassium).toMatchObject({ unit: 'mg' });
    expect(scaled.nutrients.potassium?.amount).toBeCloseTo(480.1851, 12);
    expect(scaled.nutrients.vitaminC).toMatchObject({ unit: 'mg' });
    expect(scaled.nutrients.vitaminC?.amount).toBeCloseTo(18.5184, 12);
    expect(scaled.nutrients.vitaminD).toMatchObject({ unit: 'mcg' });
    expect(scaled.nutrients.vitaminD?.amount).toBeCloseTo(1.85184, 12);
  });

  it('does not mutate basis nutrition and preserves null and absent nutrient values', () => {
    const source: ScalableNutrition = {
      ...basisNutrition,
      carbs: null,
      fiber: null,
      nutrients: {
        potassium: { amount: 5, unit: 'mg' },
      },
    };
    const snapshot = structuredClone(source);

    const scaled = scaleNutritionAtFullPrecision(source, 2);

    expect(source).toEqual(snapshot);
    expect(scaled.carbs).toBeNull();
    expect(scaled.fiber).toBeNull();
    expect(scaled.nutrients).toEqual({
      potassium: { amount: 10, unit: 'mg' },
    });
    expect(scaled.nutrients).not.toHaveProperty('vitaminC');
  });

  it('retains full precision until explicit storage rounding', () => {
    const scaled = scaleNutritionAtFullPrecision(
      {
        calories: 100.5,
        protein: 1.23456,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: 100.5,
        nutrients: {
          vitaminC: { amount: 1.23456, unit: 'mg' },
        },
      },
      1 / 3,
    );

    expect(scaled).toMatchObject({
      calories: 33.5,
      protein: 0.41152,
      sodium: 33.5,
      nutrients: {
        vitaminC: { amount: 0.41152, unit: 'mg' },
      },
    });
    expect(roundServingNutritionForStorage(scaled)).toEqual({
      calories: 34,
      protein: 0.4,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: 34,
      nutrients: {
        vitaminC: { amount: 0.4115, unit: 'mg' },
      },
    });
  });

  it('rounds storage nutrition and serving weight with existing precision conventions', () => {
    expect(
      roundServingNutritionForStorage({
        calories: 100.5,
        protein: 12.345,
        carbs: 6.789,
        fat: 1.234,
        fiber: 0.555,
        sugar: 4.444,
        sodium: 99.5,
        nutrients: {
          potassium: { amount: 123.45678, unit: 'mg' },
        },
      }),
    ).toEqual({
      calories: 101,
      protein: 12.3,
      carbs: 6.8,
      fat: 1.2,
      fiber: 0.6,
      sugar: 4.4,
      sodium: 100,
      nutrients: {
        potassium: { amount: 123.4568, unit: 'mg' },
      },
    });
    expect(roundServingWeightForDisplay(123.45)).toBe(123.5);
  });

  it.each([
    ['1', 'NOT_A_NUMBER'],
    [0, 'ZERO_OR_NEGATIVE'],
    [-1, 'ZERO_OR_NEGATIVE'],
    [Number.NaN, 'NOT_FINITE'],
    [Number.POSITIVE_INFINITY, 'NOT_FINITE'],
    [Number.NEGATIVE_INFINITY, 'NOT_FINITE'],
    [10_000.01, 'ABOVE_MAXIMUM'],
  ])('rejects invalid quantity %p', (quantity, code) => {
    expect(validateServingQuantity(quantity)).toEqual({
      success: false,
      error: expect.objectContaining({ code }),
    });
  });

  it('accepts exactly 10,000 as a quantity', () => {
    expect(validateServingQuantity(10_000)).toEqual({
      success: true,
      quantity: 10_000,
    });
  });

  it('rejects an overflowing multiplier even when both quantities are valid', () => {
    expect(
      calculateServingMultiplier({
        requestedQuantity: 10_000,
        basisQuantity: Number.MIN_VALUE,
        directlyCompatible: true,
      }),
    ).toEqual({
      success: false,
      error: expect.objectContaining({ code: 'NOT_FINITE' }),
    });
  });

  it('requires callers to establish direct compatibility before calculating a multiplier', () => {
    expect(
      calculateServingMultiplier({
        requestedQuantity: 2,
        basisQuantity: 1,
        directlyCompatible: false,
      }),
    ).toEqual({
      success: false,
      error: expect.objectContaining({ code: 'INCOMPATIBLE_UNITS' }),
    });
  });

  it('does not treat different count units as directly compatible', () => {
    expect(areServingUnitsDirectlyCompatible('egg', 'slice')).toBe(false);
    expect(areServingUnitsDirectlyCompatible('bar', 'item')).toBe(false);
    expect(areServingUnitsDirectlyCompatible('egg', 'eggs')).toBe(true);
  });

  it('does not convert distinct mass, volume, or mass-volume units', () => {
    expect(areServingUnitsDirectlyCompatible('g', 'kg')).toBe(false);
    expect(areServingUnitsDirectlyCompatible('cup', 'tbsp')).toBe(false);
    expect(areServingUnitsDirectlyCompatible('mL', 'g')).toBe(false);
  });

  it.each([
    ['cup', { unit: 'cup', family: 'household' }],
    ['tablespoon', { unit: 'tbsp', family: 'household' }],
    ['bowl', { unit: 'bowl', family: 'household' }],
    ['plate', { unit: 'plate', family: 'household' }],
  ])('classifies %s without converting it', (input, expected) => {
    expect(classifyServingUnit(input)).toEqual(expected);
  });

  it.each([
    ['metric_cup', { unit: 'metric_cup', family: 'volume' }],
    ['us_cup', { unit: 'us_cup', family: 'volume' }],
    ['imperial_fl_oz', { unit: 'imperial_fl_oz', family: 'volume' }],
  ])(
    'classifies explicit regional volume codes without inferring them',
    (input, expected) => {
      expect(classifyServingUnit(input)).toEqual(expected);
    },
  );

  it('keeps bare fluid ounces unresolved household units', () => {
    expect(classifyServingUnit('fl oz')).toEqual({
      unit: 'fl_oz',
      family: 'household',
    });
  });
});
