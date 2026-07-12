import { describe, expect, it } from 'vitest';
import {
  availableServingChoices,
  backendServingMessage,
  convertServingAmountForUnitChange,
  changeServingChoice,
  provisionalServingPreview,
} from '../../mobile/src/lib/serving-preview.js';

const nutrition = {
  calories: 101,
  protein: 10.1,
  carbs: 5.5,
  fat: 2.2,
  fiber: null,
  sugar: null,
  sodium: 50,
  nutrients: {
    potassium: { amount: 120.1234, unit: 'mg' as const },
  },
};

const gramBasis = {
  name: 'Preview food',
  servingQuantity: 100,
  servingUnit: 'g',
  nutrition,
  servingOptions: null,
};

describe('mobile provisional serving previews', () => {
  it.each([
    [100, 'g', 'kg', 0.1],
    [0.1, 'kg', 'g', 100],
    [500, 'g', 'kg', 0.5],
    [250, 'ml', 'l', 0.25],
    [0.5, 'l', 'ml', 500],
    [16, 'oz', 'lb', 1],
    [1, 'lb', 'oz', 16],
  ] as const)(
    'preserves physical amount changing %s %s to %s',
    (amount, fromUnit, toUnit, expected) => {
      expect(
        convertServingAmountForUnitChange({ amount, fromUnit, toUnit }),
      ).toMatchObject({ kind: 'converted', persistedQuantity: expected });
    },
  );

  it('returns a persistable quantized conversion and uses it in the state transition', () => {
    const result = convertServingAmountForUnitChange({
      amount: 100,
      fromUnit: 'g',
      toUnit: 'lb',
    });
    expect(result).toMatchObject({
      kind: 'converted',
      exactConvertedQuantity: expect.any(Number),
      persistedQuantity: 0.22,
      displayText: '0.22',
      targetUnit: 'lb',
    });
    expect(
      changeServingChoice(
        { amount: '100', unit: 'g', servingOptionId: null },
        { id: 'unit:lb', label: 'lb', unit: 'lb', servingOptionId: null },
      ),
    ).toEqual({ amount: '0.22', unit: 'lb', servingOptionId: null });
  });

  it('refuses a conversion that rounds to zero without changing state', () => {
    expect(
      convertServingAmountForUnitChange({
        amount: 1,
        fromUnit: 'g',
        toUnit: 'lb',
      }),
    ).toMatchObject({ kind: 'too_small', targetUnit: 'lb' });
    expect(
      changeServingChoice(
        { amount: '1', unit: 'g', servingOptionId: null },
        { id: 'unit:lb', label: 'lb', unit: 'lb', servingOptionId: null },
      ),
    ).toMatchObject({
      amount: '1',
      unit: 'g',
      error: expect.stringContaining('too small'),
    });
  });

  it.each([
    ['g', 'ml'],
    ['egg', 'item'],
    ['cup', 'g'],
  ] as const)(
    'does not convert incompatible units %s to %s',
    (fromUnit, toUnit) => {
      expect(
        convertServingAmountForUnitChange({ amount: 1, fromUnit, toUnit }).kind,
      ).toBe('incompatible');
    },
  );

  it.each([
    [{ quantity: 200, unit: 'g' }, 'exact', 2, 202, 20.2, 'g'],
    [{ quantity: 0.5, unit: 'kilograms' }, 'converted', 5, 505, 50.5, 'kg'],
  ] as const)(
    'uses the shared resolver and storage rounding for %o',
    (request, status, multiplier, calories, protein, unit) => {
      const preview = provisionalServingPreview({
        basis: gramBasis,
        request,
      });

      expect(preview).toMatchObject({
        status,
        multiplier,
        requestedServing: { quantity: request.quantity, unit },
        nutrition: {
          calories,
          protein,
          nutrients: {
            potassium: { amount: 120.1234 * multiplier, unit: 'mg' },
          },
        },
      });
    },
  );

  it('uses a selected trusted option without inventing an egg conversion', () => {
    const preview = provisionalServingPreview({
      basis: {
        ...gramBasis,
        servingOptions: {
          schemaVersion: 1,
          options: [
            {
              id: 'egg-50g',
              label: '1 egg',
              quantity: 1,
              unit: 'egg',
              unitFamily: 'count',
              equivalentWeightGrams: 50,
              equivalentVolumeMl: null,
              source: 'provider',
              trust: 'trusted',
              provider: 'usda_fdc',
              providerDescription: '1 egg = 50 g',
            },
          ],
        },
      },
      request: { quantity: 2, unit: 'eggs', servingOptionId: 'egg-50g' },
    });

    expect(preview).toMatchObject({
      status: 'converted',
      multiplier: 1,
      requestedServing: {
        quantity: 2,
        unit: 'egg',
        servingOptionId: 'egg-50g',
      },
      nutrition: { calories: 101 },
    });
  });

  it('does not fabricate nutrition for a bare household serving', () => {
    const preview = provisionalServingPreview({
      basis: gramBasis,
      request: { quantity: 1, unit: 'cup' },
    });

    expect(preview).toMatchObject({
      status: 'needs_review',
      message:
        'This food does not have a trusted cup conversion. Choose grams or a listed serving.',
    });
    expect(preview.nutrition).toBeNull();
    expect(preview.multiplier).toBeNull();
  });

  it.each(['', '0', '-2', '10001', 'not a number'])(
    'rejects invalid amount text %s without a preview',
    (amountText) => {
      const preview = provisionalServingPreview({
        basis: gramBasis,
        request: { quantityText: amountText, unit: 'g' },
      });

      expect(preview.status).toBe('invalid');
      expect(preview.nutrition).toBeNull();
      expect(preview.multiplier).toBeNull();
    },
  );

  it('offers only safe consumer units and trusted option labels', () => {
    expect(
      availableServingChoices({
        ...gramBasis,
        servingOptions: {
          schemaVersion: 1,
          options: [
            {
              id: 'cup-158g',
              label: '1 cup',
              quantity: 1,
              unit: 'cup',
              unitFamily: 'household',
              equivalentWeightGrams: 158,
              equivalentVolumeMl: null,
              source: 'provider',
              trust: 'trusted',
              provider: 'usda_fdc',
              providerDescription: '1 cup = 158 g',
            },
          ],
        },
      }),
    ).toEqual([
      { id: 'unit:g', label: 'g', unit: 'g', servingOptionId: null },
      { id: 'unit:kg', label: 'kg', unit: 'kg', servingOptionId: null },
      { id: 'unit:oz', label: 'oz', unit: 'oz', servingOptionId: null },
      { id: 'unit:lb', label: 'lb', unit: 'lb', servingOptionId: null },
      {
        id: 'option:cup-158g',
        label: '1 cup',
        unit: 'cup',
        servingOptionId: 'cup-158g',
      },
    ]);
  });

  it('maps stable backend serving errors to safe field guidance', () => {
    expect(backendServingMessage('SERVING_OPTION_UNAVAILABLE')).toBe(
      'That serving option is no longer available. Choose another listed serving.',
    );
    expect(backendServingMessage('SERVING_OVERRIDE_ACTION_REQUIRED')).toBe(
      'Choose whether to remove or replace the nutrition adjustment before changing the serving.',
    );
  });
});
