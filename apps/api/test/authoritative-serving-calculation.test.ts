import {
  calculateAuthoritativeServing,
  AuthoritativeServingInvariantError,
  type AuthoritativeServingCalculationInput,
} from '../src/modules/foodLogs/serving-resolution.js';
import { describe, expect, it } from 'vitest';

const provenance = {
  basisOrigin: 'food_item' as const,
  foodItemId: '00000000-0000-4000-8000-000000000001',
  sourceType: 'cached_external' as const,
  sourceProvider: 'usda_fdc' as const,
  sourceId: '123',
  trustLevel: 'trusted' as const,
};

const input = (): AuthoritativeServingCalculationInput => ({
  basis: {
    quantity: 100,
    unit: 'grams',
    displayText: 'per 100 grams',
    equivalentWeightGrams: 100,
    equivalentVolumeMl: null,
  },
  basisNutrition: {
    calories: 101,
    protein: 10.06,
    carbs: 5.55,
    fat: 2.22,
    fiber: null,
    sugar: null,
    sodium: 50,
    nutrients: {
      potassium: { amount: 120.12345, unit: 'mg' },
      vitaminD: { amount: 1.23456, unit: 'mcg' },
    },
  },
  servingOptions: null,
  provenance,
});

function successful(
  overrides: Partial<AuthoritativeServingCalculationInput> = {},
) {
  const result = calculateAuthoritativeServing({ ...input(), ...overrides });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected success');
  return result;
}

describe('calculateAuthoritativeServing', () => {
  it('defaults to one canonical basis serving', () => {
    const result = successful();
    expect(result.finalNutrition).toMatchObject({
      calories: 101,
      protein: 10.1,
    });
    expect(result.servingSnapshot.requestedServing).toMatchObject({
      quantity: 100,
      unit: 'g',
      unitFamily: 'mass',
    });
  });

  it.each([
    [2, 202],
    [0.5, 51],
  ])(
    'uses multiplier %p in canonical basis units',
    (servingMultiplier, calories) => {
      const result = successful({ servingMultiplier });
      expect(result.finalNutrition.calories).toBe(calories);
      expect(result.servingSnapshot.requestedServing).toMatchObject({
        quantity: 100 * servingMultiplier,
        unit: 'g',
      });
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 101])(
    'rejects invalid multiplier %p',
    (servingMultiplier) => {
      const result = calculateAuthoritativeServing({
        ...input(),
        servingMultiplier,
      });
      expect(result).toMatchObject({
        ok: false,
        code: 'INVALID_SERVING_REQUEST',
        status: 'invalid',
        reason: 'invalid_quantity',
      });
    },
  );

  it('rejects a serving and multiplier together', () => {
    expect(
      calculateAuthoritativeServing({
        ...input(),
        serving: { quantity: 1, unit: 'g' },
        servingMultiplier: 1,
      }),
    ).toEqual({
      ok: false,
      code: 'SERVING_CONFLICT',
      status: 'invalid',
      reason: 'serving_conflict',
    });
  });

  it.each([
    [0, 'g'],
    [-1, 'g'],
    [10001, 'g'],
    [100, 'unknown'],
  ])('rejects invalid basis %p %s', (quantity, unit) => {
    expect(
      calculateAuthoritativeServing({
        ...input(),
        basis: { ...input().basis, quantity, unit },
      }),
    ).toEqual({
      ok: false,
      code: 'INVALID_SERVING_BASIS',
      status: 'invalid',
      reason: 'invalid_basis',
    });
  });

  it('converts mass and canonicalizes an input alias in the snapshot', () => {
    const result = successful({
      serving: { quantity: 0.2, unit: 'kilograms' },
    });
    expect(result.finalNutrition.calories).toBe(202);
    expect(result.servingSnapshot).toMatchObject({
      requestedServing: { unit: 'kg' },
      resolution: { status: 'converted', reason: 'standard_mass_conversion' },
    });
  });

  it('converts volume servings', () => {
    const result = successful({
      basis: {
        ...input().basis,
        quantity: 250,
        unit: 'ml',
        equivalentWeightGrams: null,
        equivalentVolumeMl: 250,
      },
      serving: { quantity: 0.5, unit: 'litres' },
    });
    expect(result.servingSnapshot).toMatchObject({
      requestedServing: { unit: 'l' },
      resolution: { multiplier: 2, reason: 'standard_volume_conversion' },
    });
  });

  it.each([
    ['egg-50g', 'egg', 2, 100],
    ['slice-25g', 'slice', 4, 100],
    ['cup-158g', 'cup', 1, 158],
  ])('resolves trusted option %s', (id, unit, quantity, grams) => {
    const result = successful({
      serving: { quantity, unit },
      servingOptions: {
        schemaVersion: 1,
        options: [
          {
            id,
            label: `1 ${unit}`,
            quantity: 1,
            unit,
            unitFamily: unit === 'cup' ? 'household' : 'count',
            equivalentWeightGrams: grams / quantity,
            equivalentVolumeMl: null,
            source: 'provider',
            trust: 'trusted',
            provider: 'usda_fdc',
            providerDescription: `${unit} basis`,
          },
        ],
      },
    });
    expect(result.servingSnapshot).toMatchObject({
      requestedServing: { servingOptionId: id, selectedServingOption: { id } },
      resolution: { reason: 'trusted_serving_weight' },
    });
  });

  it('requires review for a missing household bridge', () => {
    const result = calculateAuthoritativeServing({
      ...input(),
      serving: { quantity: 1, unit: 'cup' },
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'SERVING_NEEDS_REVIEW',
      status: 'needs_review',
      reason: 'unknown_household_unit',
    });
    expect(result).not.toHaveProperty('servingSnapshot');
  });

  it('requires review for ambiguous trusted options', () => {
    const result = calculateAuthoritativeServing({
      ...input(),
      serving: { quantity: 1, unit: 'cup' },
      servingOptions: {
        schemaVersion: 1,
        options: [
          {
            id: 'cup-a',
            label: 'small cup',
            quantity: 1,
            unit: 'cup',
            unitFamily: 'household',
            equivalentWeightGrams: 120,
            equivalentVolumeMl: null,
            source: 'provider',
            trust: 'trusted',
            provider: 'usda_fdc',
            providerDescription: 'small',
          },
          {
            id: 'cup-b',
            label: 'large cup',
            quantity: 1,
            unit: 'cup',
            unitFamily: 'household',
            equivalentWeightGrams: 180,
            equivalentVolumeMl: null,
            source: 'provider',
            trust: 'trusted',
            provider: 'usda_fdc',
            providerDescription: 'large',
          },
        ],
      },
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'SERVING_NEEDS_REVIEW',
      reason: 'ambiguous_serving_option',
    });
  });

  it.each([null, { schemaVersion: 1, options: [] }, { nope: true }])(
    'treats invalid stored options %p as no options',
    (servingOptions) => {
      expect(
        calculateAuthoritativeServing({
          ...input(),
          servingOptions,
          serving: { quantity: 1, unit: 'egg' },
        }),
      ).toMatchObject({ ok: false, code: 'SERVING_NEEDS_REVIEW' });
    },
  );

  it('returns an invalid failure for a missing selected option', () => {
    expect(
      calculateAuthoritativeServing({
        ...input(),
        serving: { quantity: 1, unit: 'egg', servingOptionId: 'missing' },
      }),
    ).toMatchObject({
      ok: false,
      code: 'SERVING_RESOLUTION_INVALID',
      reason: 'invalid_serving_option',
    });
  });

  it('returns an invalid failure with no calculated data', () => {
    const result = calculateAuthoritativeServing({
      ...input(),
      serving: { quantity: 1, unit: 'unsupported' },
    });
    expect(result).toMatchObject({
      ok: false,
      code: 'INVALID_SERVING_REQUEST',
      status: 'invalid',
      reason: 'unsupported_unit',
    });
    expect(result).not.toHaveProperty('finalNutrition');
  });

  it('rounds scaled column-backed and normalized nutrients once', () => {
    const result = successful({ serving: { quantity: 50, unit: 'g' } });
    expect(result.finalNutrition).toEqual({
      calories: 51,
      protein: 5,
      carbs: 2.8,
      fat: 1.1,
      fiber: null,
      sugar: null,
      sodium: 25,
      nutrients: {
        potassium: { amount: 60.0617, unit: 'mg' },
        vitaminD: { amount: 0.6173, unit: 'mcg' },
      },
    });
    expect(result.finalNutrients).toEqual([
      { nutrientKey: 'potassium', amount: 60.0617, unit: 'mg' },
      { nutrientKey: 'vitaminD', amount: 0.6173, unit: 'mcg' },
    ]);
  });

  it('applies every supported absolute override after scaling', () => {
    const result = successful({
      servingMultiplier: 2,
      nutritionOverride: {
        mode: 'complex',
        calories: 88.6,
        protein: 7.77,
        carbs: 6.66,
        fat: 5.55,
        fiber: 4.44,
        sugar: 3.33,
        sodium: 22.5,
        nutrients: { potassium: { amount: 9.87654, unit: 'mg' } },
      },
    });
    expect(result.finalNutrition).toEqual({
      calories: 89,
      protein: 7.8,
      carbs: 6.7,
      fat: 5.6,
      fiber: 4.4,
      sugar: 3.3,
      sodium: 23,
      nutrients: {
        potassium: { amount: 9.8765, unit: 'mg' },
        vitaminD: { amount: 2.4691, unit: 'mcg' },
      },
    });
    expect(result.servingSnapshot.nutritionOverride?.calories).toEqual({
      applied: true,
      value: 89,
    });
  });

  it('preserves null semantics for column overrides and clears nutrients', () => {
    const result = successful({
      nutritionOverride: {
        mode: 'complex',
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrients: null,
      },
    });
    expect(result.finalNutrition).toMatchObject({
      calories: 101,
      protein: 10.1,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: {},
    });
    expect(result.servingSnapshot.nutritionOverride).toMatchObject({
      calories: { applied: false, value: null },
      protein: { applied: false, value: null },
      carbs: { applied: true, value: null },
      nutrients: { applied: true, value: null },
    });
  });

  it('does not snapshot an empty or non-effective override', () => {
    expect(
      successful({
        nutritionOverride: {
          mode: 'simple',
          calories: null,
          protein: null,
          nutrients: {},
        },
      }).servingSnapshot.nutritionOverride,
    ).toBeNull();
  });

  it('supports per-nutrient Unknown without clearing unrelated values', () => {
    const result = successful({
      nutritionOverride: {
        mode: 'complex',
        nutrients: { potassium: { amount: null, unit: 'mg' } },
      },
    });
    expect(result.finalNutrition.nutrients).toEqual({
      vitaminD: { amount: 1.2346, unit: 'mcg' },
    });
  });

  it.each([
    [
      {
        basisOrigin: 'manual_basis',
        foodItemId: null,
        sourceType: null,
        sourceProvider: null,
        sourceId: null,
        trustLevel: 'user_entered',
      },
      'manual_basis',
    ],
    [
      {
        basisOrigin: 'ai_estimate',
        foodItemId: null,
        sourceType: null,
        sourceProvider: null,
        sourceId: null,
        trustLevel: 'low',
      },
      'ai_estimate',
    ],
  ] as const)('preserves %s provenance', (variant, basisOrigin) => {
    expect(
      successful({ provenance: variant }).servingSnapshot.provenance
        .basisOrigin,
    ).toBe(basisOrigin);
  });

  it('normalizes invalid optional equivalents to null', () => {
    const result = successful({
      basis: {
        ...input().basis,
        equivalentWeightGrams: -1,
        equivalentVolumeMl: Number.POSITIVE_INFINITY,
      },
    });
    expect(result.servingSnapshot.nutritionBasis).toMatchObject({
      equivalentWeightGrams: null,
      equivalentVolumeMl: null,
    });
  });

  it('keeps a household basis valid only for same-unit scaling', () => {
    expect(
      successful({
        basis: {
          ...input().basis,
          quantity: 1,
          unit: 'cup',
          equivalentWeightGrams: null,
        },
        serving: { quantity: 2, unit: 'cups' },
      }).finalNutrition.calories,
    ).toBe(202);
    expect(
      calculateAuthoritativeServing({
        ...input(),
        basis: {
          ...input().basis,
          quantity: 1,
          unit: 'cup',
          equivalentWeightGrams: null,
        },
        serving: { quantity: 100, unit: 'g' },
      }),
    ).toMatchObject({ ok: false, code: 'SERVING_NEEDS_REVIEW' });
  });

  it('uses a canonical medium-item basis for a legacy multiplier request', () => {
    const result = calculateAuthoritativeServing({
      ...input(),
      basis: {
        quantity: 1,
        unit: 'medium item',
        displayText: 'per 1 medium item',
        equivalentWeightGrams: null,
        equivalentVolumeMl: null,
      },
      servingMultiplier: 2,
    });

    expect(result).toMatchObject({
      ok: true,
      finalNutrition: { calories: 202 },
      servingSnapshot: {
        requestedServing: { quantity: 2, unit: 'medium_item' },
        resolution: { multiplier: 2, reason: 'same_basis' },
      },
    });
  });

  it('throws the dedicated invariant error for an invalid assembled snapshot', () => {
    expect(() =>
      calculateAuthoritativeServing({
        ...input(),
        provenance: {
          ...provenance,
          sourceId: '',
        } as AuthoritativeServingCalculationInput['provenance'],
      }),
    ).toThrow(AuthoritativeServingInvariantError);
    try {
      calculateAuthoritativeServing({
        ...input(),
        provenance: {
          ...provenance,
          sourceId: '',
        } as AuthoritativeServingCalculationInput['provenance'],
      });
    } catch (error) {
      expect(error).toMatchObject({ code: 'SERVING_SNAPSHOT_INVALID' });
    }
  });

  it('returns a serializable result without mutating input', () => {
    const value = input();
    const before = structuredClone(value);
    const result = calculateAuthoritativeServing(value);
    expect(value).toEqual(before);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
