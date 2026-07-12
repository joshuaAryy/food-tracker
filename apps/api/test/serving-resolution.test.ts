import {
  resolveServingRequest,
  type NutritionBasis,
  type ServingOption,
  type ServingRequest,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';

const gramBasis: NutritionBasis = {
  quantity: 100,
  unit: 'g',
  displayText: 'per 100 g',
};

function resolve(
  request: ServingRequest,
  basis: NutritionBasis = gramBasis,
  servingOptions: readonly ServingOption[] = [],
) {
  return resolveServingRequest({ request, basis, servingOptions });
}

function trustedOption(
  option: Omit<ServingOption, 'source' | 'trust'>,
): ServingOption {
  return { ...option, source: 'provider', trust: 'trusted' };
}

describe('deterministic serving resolution', () => {
  it('resolves the same nutrition basis exactly', () => {
    expect(resolve({ quantity: 200, unit: 'grams' })).toEqual({
      status: 'exact',
      reason: 'same_basis',
      requestedQuantity: 200,
      requestedUnit: 'g',
      requestedUnitFamily: 'mass',
      basisQuantity: 100,
      basisUnit: 'g',
      basisUnitFamily: 'mass',
      servingOptionId: null,
      multiplier: 2,
      resolvedWeightGrams: 200,
      resolvedVolumeMl: null,
    });
  });

  it('converts standard mass units only within the mass family', () => {
    expect(resolve({ quantity: 0.2, unit: 'kg' })).toMatchObject({
      status: 'converted',
      reason: 'standard_mass_conversion',
      multiplier: 2,
      resolvedWeightGrams: 200,
      resolvedVolumeMl: null,
    });
  });

  it('converts standard volume units only within the volume family', () => {
    expect(
      resolve({ quantity: 0.5, unit: 'L' }, { quantity: 250, unit: 'mL' }),
    ).toMatchObject({
      status: 'converted',
      reason: 'standard_volume_conversion',
      multiplier: 2,
      resolvedWeightGrams: null,
      resolvedVolumeMl: 500,
    });
  });

  it('does not convert a bare cup to millilitres without a trusted option', () => {
    expect(
      resolve({ quantity: 1, unit: 'cup' }, { quantity: 250, unit: 'mL' }),
    ).toMatchObject({
      status: 'needs_review',
      reason: 'unknown_household_unit',
      multiplier: null,
    });
  });

  it.each([
    ['metric_cup', 250],
    ['us_cup', 236.5882365],
    ['imperial_fl_oz', 28.4130625],
  ])(
    'converts explicit regional unit %s only by its explicit definition',
    (unit, expectedMl) => {
      expect(
        resolve({ quantity: 1, unit }, { quantity: 1, unit: 'mL' }),
      ).toMatchObject({
        status: 'converted',
        reason: 'standard_volume_conversion',
        multiplier: expectedMl,
        resolvedVolumeMl: expectedMl,
      });
    },
  );

  it('resolves identical count units without interchanging count identities', () => {
    expect(
      resolve({ quantity: 2, unit: 'bars' }, { quantity: 1, unit: 'bar' }),
    ).toMatchObject({
      status: 'exact',
      reason: 'direct_count_basis',
      multiplier: 2,
      resolvedWeightGrams: null,
      resolvedVolumeMl: null,
    });
  });

  it('resolves an identical household basis without implying a physical conversion', () => {
    expect(
      resolve({ quantity: 2, unit: 'bowls' }, { quantity: 1, unit: 'bowl' }),
    ).toMatchObject({
      status: 'exact',
      reason: 'same_basis',
      multiplier: 2,
      resolvedWeightGrams: null,
      resolvedVolumeMl: null,
    });
  });

  it('converts count to a mass basis through a trusted serving weight', () => {
    const egg = trustedOption({
      id: 'egg-50g',
      label: '1 egg',
      quantity: 1,
      unit: 'egg',
      equivalentWeightGrams: 50,
    });

    expect(
      resolve({ quantity: 2, unit: 'eggs' }, gramBasis, [egg]),
    ).toMatchObject({
      status: 'converted',
      reason: 'trusted_serving_weight',
      servingOptionId: 'egg-50g',
      multiplier: 1,
      resolvedWeightGrams: 100,
    });
  });

  it('converts mass to a count basis through the count basis trusted weight', () => {
    const bar = trustedOption({
      id: 'bar-75g',
      label: '1 bar',
      quantity: 1,
      unit: 'bar',
      equivalentWeightGrams: 75,
    });

    expect(
      resolve({ quantity: 150, unit: 'g' }, { quantity: 1, unit: 'bar' }, [
        bar,
      ]),
    ).toMatchObject({
      status: 'converted',
      reason: 'trusted_serving_weight',
      servingOptionId: 'bar-75g',
      multiplier: 2,
      resolvedWeightGrams: 150,
    });
  });

  it('converts a household option only through its trusted food-specific weight', () => {
    const cup = trustedOption({
      id: 'cooked-cup',
      label: '1 cup cooked',
      quantity: 1,
      unit: 'cup',
      equivalentWeightGrams: 158,
      providerDescription: '1 cup, cooked',
    });

    expect(
      resolve({ quantity: 1, unit: 'cup' }, gramBasis, [cup]),
    ).toMatchObject({
      status: 'converted',
      reason: 'trusted_serving_weight',
      servingOptionId: 'cooked-cup',
      multiplier: 1.58,
      resolvedWeightGrams: 158,
    });
  });

  it('converts count to a volume basis through a trusted serving volume', () => {
    const serving = trustedOption({
      id: 'serving-250ml',
      label: '1 serving',
      quantity: 1,
      unit: 'serving',
      equivalentVolumeMl: 250,
    });

    expect(
      resolve({ quantity: 2, unit: 'serving' }, { quantity: 250, unit: 'mL' }, [
        serving,
      ]),
    ).toMatchObject({
      status: 'converted',
      reason: 'trusted_serving_volume',
      servingOptionId: 'serving-250ml',
      multiplier: 2,
      resolvedVolumeMl: 500,
    });
  });

  it('requires review for an unknown household unit', () => {
    expect(resolve({ quantity: 1, unit: 'bowl' })).toMatchObject({
      status: 'needs_review',
      reason: 'unknown_household_unit',
      multiplier: null,
    });
  });

  it('requires review for a known but missing count conversion', () => {
    expect(
      resolve({ quantity: 2, unit: 'egg' }, { quantity: 1, unit: 'slice' }),
    ).toMatchObject({
      status: 'needs_review',
      reason: 'missing_conversion',
      multiplier: null,
    });
  });

  it('requires review for volume to mass without a trusted food relationship', () => {
    expect(resolve({ quantity: 250, unit: 'mL' })).toMatchObject({
      status: 'needs_review',
      reason: 'incompatible_unit',
      multiplier: null,
      resolvedWeightGrams: null,
      resolvedVolumeMl: null,
    });
  });

  it('does not infer a global gram weight for a cup', () => {
    expect(resolve({ quantity: 1, unit: 'cup' })).toMatchObject({
      status: 'needs_review',
      reason: 'unknown_household_unit',
      multiplier: null,
      resolvedWeightGrams: null,
    });
  });

  it('requires review when multiple trusted options can resolve the request', () => {
    const options = [
      trustedOption({
        id: 'small-cup',
        label: '1 small cup',
        quantity: 1,
        unit: 'cup',
        equivalentWeightGrams: 140,
      }),
      trustedOption({
        id: 'large-cup',
        label: '1 large cup',
        quantity: 1,
        unit: 'cup',
        equivalentWeightGrams: 190,
      }),
    ];

    expect(
      resolve({ quantity: 1, unit: 'cup' }, gramBasis, options),
    ).toMatchObject({
      status: 'needs_review',
      reason: 'ambiguous_serving_option',
      servingOptionId: null,
      multiplier: null,
    });
  });

  it('uses an explicitly selected trusted option to resolve ambiguity', () => {
    const options = [
      trustedOption({
        id: 'small-cup',
        label: '1 small cup',
        quantity: 1,
        unit: 'cup',
        equivalentWeightGrams: 140,
      }),
      trustedOption({
        id: 'large-cup',
        label: '1 large cup',
        quantity: 1,
        unit: 'cup',
        equivalentWeightGrams: 190,
      }),
    ];

    expect(
      resolve(
        { quantity: 1, unit: 'cup', servingOptionId: 'large-cup' },
        gramBasis,
        options,
      ),
    ).toMatchObject({
      status: 'converted',
      reason: 'trusted_serving_weight',
      servingOptionId: 'large-cup',
      multiplier: 1.9,
      resolvedWeightGrams: 190,
    });
  });

  it.each([
    [{ quantity: 0, unit: 'g' }, 'invalid_quantity'],
    [{ quantity: Number.NaN, unit: 'g' }, 'invalid_quantity'],
    [{ quantity: 1, unit: 'scoop' }, 'unsupported_unit'],
  ] as const)('returns invalid for malformed request %#', (request, reason) => {
    expect(resolve(request)).toMatchObject({
      status: 'invalid',
      reason,
      multiplier: null,
    });
  });

  it.each([
    [{ quantity: 0, unit: 'g' }, 'invalid_basis'],
    [{ quantity: 100, unit: 'scoop' }, 'invalid_basis'],
  ] as const)('returns invalid for malformed basis %#', (basis, reason) => {
    expect(resolve({ quantity: 100, unit: 'g' }, basis)).toMatchObject({
      status: 'invalid',
      reason,
      multiplier: null,
    });
  });

  it('returns invalid for a selected option that does not exist', () => {
    expect(
      resolve(
        { quantity: 1, unit: 'cup', servingOptionId: 'missing' },
        gramBasis,
        [],
      ),
    ).toMatchObject({
      status: 'invalid',
      reason: 'invalid_serving_option',
      servingOptionId: 'missing',
      multiplier: null,
    });
  });

  it('returns invalid when a selected option is unrelated to a direct basis request', () => {
    const egg = trustedOption({
      id: 'egg-50g',
      label: '1 egg',
      quantity: 1,
      unit: 'egg',
      equivalentWeightGrams: 50,
    });

    expect(
      resolve(
        { quantity: 200, unit: 'g', servingOptionId: 'egg-50g' },
        gramBasis,
        [egg],
      ),
    ).toMatchObject({
      status: 'invalid',
      reason: 'invalid_serving_option',
      multiplier: null,
    });
  });

  it('returns invalid for malformed trusted serving metadata', () => {
    const malformed = trustedOption({
      id: 'bad-egg',
      label: 'Bad egg',
      quantity: 0,
      unit: 'egg',
      equivalentWeightGrams: -50,
    });

    expect(
      resolve({ quantity: 2, unit: 'egg' }, gramBasis, [malformed]),
    ).toMatchObject({
      status: 'invalid',
      reason: 'invalid_serving_option',
      multiplier: null,
    });
  });

  it('returns invalid instead of an infinite standard-unit multiplier', () => {
    expect(
      resolve(
        { quantity: 10_000, unit: 'kg' },
        { quantity: Number.MIN_VALUE, unit: 'g' },
      ),
    ).toMatchObject({
      status: 'invalid',
      reason: 'invalid_basis',
      multiplier: null,
    });
  });

  it('does not mutate the request, basis, or trusted options', () => {
    const request: ServingRequest = { quantity: 2, unit: 'eggs' };
    const basis = structuredClone(gramBasis);
    const options = [
      trustedOption({
        id: 'egg-50g',
        label: '1 egg',
        quantity: 1,
        unit: 'egg',
        equivalentWeightGrams: 50,
      }),
    ];
    const snapshot = structuredClone({ request, basis, options });

    resolve(request, basis, options);

    expect({ request, basis, options }).toEqual(snapshot);
  });
});
