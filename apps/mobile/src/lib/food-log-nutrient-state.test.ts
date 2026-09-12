import { describe, expect, it } from 'vitest';
import { editNutrientValuesFromSnapshot } from './food-log-nutrient-state';

describe('FoodLog normalized nutrient edit state', () => {
  it('hydrates numeric, explicit zero, and Unknown from a persisted override', () => {
    const values = editNutrientValuesFromSnapshot({
      basisNutrition: {
        nutrients: {
          addedSugar: { amount: 1, unit: 'g' },
          starch: { amount: 3, unit: 'g' },
          solubleFiber: { amount: 4, unit: 'g' },
        },
      },
      nutritionOverride: {
        nutrients: {
          applied: true,
          value: {
            addedSugar: { amount: 2, unit: 'g' },
            starch: { amount: 0, unit: 'g' },
          },
        },
      },
    });

    expect(values.addedSugar).toBe('2');
    expect(values.starch).toBe('0');
    expect(values.solubleFiber).toBe('');
  });

  it('uses the frozen basis when no normalized override was persisted', () => {
    const values = editNutrientValuesFromSnapshot({
      basisNutrition: {
        nutrients: {
          addedSugar: { amount: 1.5, unit: 'g' },
        },
      },
      nutritionOverride: null,
    });

    expect(values.addedSugar).toBe('1.5');
    expect(values.starch).toBe('');
  });
});
