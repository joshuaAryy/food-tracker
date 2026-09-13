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
});
