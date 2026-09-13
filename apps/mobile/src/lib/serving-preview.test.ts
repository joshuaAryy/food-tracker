import { describe, expect, it } from 'vitest';
import { changeServingChoice } from './serving-preview';

describe('serving choice transitions', () => {
  it('establishes the first unit when an amount exists without a unit', () => {
    expect(
      changeServingChoice(
        { amount: '100', unit: '', servingOptionId: null },
        {
          id: 'unit:g',
          label: 'g',
          unit: 'g',
          servingOptionId: null,
          quantity: 100,
        },
      ),
    ).toEqual({
      amount: '100',
      unit: 'g',
      servingOptionId: null,
    });
  });

  it('keeps compatible mass conversion behavior', () => {
    expect(
      changeServingChoice(
        { amount: '1000', unit: 'g', servingOptionId: null },
        {
          id: 'unit:kg',
          label: 'kg',
          unit: 'kg',
          servingOptionId: null,
          quantity: 100,
        },
      ),
    ).toEqual({ amount: '1', unit: 'kg', servingOptionId: null });
  });

  it('keeps incompatible unit changes recoverable', () => {
    expect(
      changeServingChoice(
        { amount: '100', unit: 'g', servingOptionId: null },
        {
          id: 'unit:ml',
          label: 'mL',
          unit: 'ml',
          servingOptionId: null,
          quantity: 100,
        },
      ),
    ).toEqual({
      amount: '100',
      unit: 'g',
      servingOptionId: null,
      error: 'Choose a compatible unit or a listed serving for this food.',
    });
  });
});
