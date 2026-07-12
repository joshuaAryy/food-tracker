import { describe, expect, it } from 'vitest';
import { parseServingText } from '@food-tracker/shared';

describe('parseServingText', () => {
  it.each([
    ['2 eggs', { quantity: 2, unit: 'egg' }],
    ['3 slices', { quantity: 3, unit: 'slice' }],
    ['200 g', { quantity: 200, unit: 'g' }],
    ['0.5 kg', { quantity: 0.5, unit: 'kg' }],
    ['250 mL', { quantity: 250, unit: 'ml' }],
    ['1 L', { quantity: 1, unit: 'l' }],
    ['1 cup', { quantity: 1, unit: 'cup' }],
    ['2 tbsp', { quantity: 2, unit: 'tbsp' }],
    ['1/2 serving', { quantity: 0.5, unit: 'serving' }],
    ['1 1/2 cups', { quantity: 1.5, unit: 'cup' }],
    ['a bar', { quantity: 1, unit: 'bar' }],
    ['half serving', { quantity: 0.5, unit: 'serving' }],
    ['TWO EGGS', { quantity: 2, unit: 'egg' }],
  ] as const)('parses %s into canonical serving data', (text, expected) => {
    expect(
      parseServingText({ quantityText: null, servingText: text }),
    ).toMatchObject({
      status: 'parsed',
      ...expected,
      rawQuantityText: null,
      rawServingText: text,
    });
  });

  it('combines a numeric quantity field with a serving unit field', () => {
    expect(
      parseServingText({ quantityText: '2', servingText: 'eggs' }),
    ).toMatchObject({ status: 'parsed', quantity: 2, unit: 'egg' });
  });

  it('preserves raw fields when no explicit serving is supplied', () => {
    expect(parseServingText({ quantityText: null, servingText: null })).toEqual(
      {
        status: 'missing',
        quantity: null,
        unit: null,
        rawQuantityText: null,
        rawServingText: null,
        reason: 'no_explicit_serving',
      },
    );
  });

  it.each([
    [{ quantityText: '2', servingText: null }, 'missing_unit'],
    [{ quantityText: null, servingText: 'cups' }, 'missing_quantity'],
    [{ quantityText: null, servingText: '1 cup or 1 bowl' }, 'ambiguous_unit'],
    [{ quantityText: null, servingText: 'medium apple' }, 'ambiguous_size'],
    [
      { quantityText: null, servingText: '1 something' },
      'unsupported_serving_text',
    ],
  ] as const)('marks unresolved text %o for review', (input, reason) => {
    expect(parseServingText(input)).toMatchObject({
      status: 'needs_review',
      reason,
      rawQuantityText: input.quantityText,
      rawServingText: input.servingText,
    });
  });

  it.each([
    ['0 eggs', 'invalid_quantity'],
    ['-2 eggs', 'invalid_quantity'],
    ['10001 g', 'quantity_out_of_range'],
    ['1/0 serving', 'invalid_quantity'],
    ['1/ serving', 'invalid_quantity'],
    ['NaN g', 'invalid_quantity'],
  ] as const)('rejects invalid quantity text %s', (text, reason) => {
    expect(
      parseServingText({ quantityText: null, servingText: text }),
    ).toMatchObject({ status: 'invalid', reason });
  });

  it('does not infer regional units or physical conversions', () => {
    expect(
      parseServingText({ quantityText: '1', servingText: 'cup' }),
    ).toMatchObject({ status: 'parsed', quantity: 1, unit: 'cup' });
    expect(
      parseServingText({ quantityText: '1', servingText: 'bowl' }),
    ).toMatchObject({ status: 'parsed', quantity: 1, unit: 'bowl' });
  });
});
