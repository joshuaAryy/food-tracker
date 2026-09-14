import { describe, expect, it } from 'vitest';
import {
  editMainNutrientValuesAfterServingPreview,
  editNutrientValuesAfterServingPreview,
  editNutrientValuesFromSnapshot,
} from './food-log-nutrient-state';

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

  it('does not let a serving preview clobber a persisted override', () => {
    const snapshot = {
      basisNutrition: { nutrients: { addedSugar: { amount: 0, unit: 'g' } } },
      nutritionOverride: {
        nutrients: {
          applied: true,
          value: { addedSugar: { amount: 2, unit: 'g' } },
        },
      },
    };

    expect(
      editNutrientValuesAfterServingPreview(
        snapshot,
        { addedSugar: { amount: 0, unit: 'g' } },
        true,
      ).addedSugar,
    ).toBe('2');
    expect(
      editNutrientValuesAfterServingPreview(
        snapshot,
        { addedSugar: { amount: 0, unit: 'g' } },
        false,
      ).addedSugar,
    ).toBe('0');
  });

  it('keeps persisted top-level overrides when a serving preview arrives', () => {
    const currentValues = {
      calories: '172',
      protein: '1.7',
      carbs: '38.6',
      fat: '1.4',
      fiber: '',
      sugar: '',
      sodium: '',
    };
    const previewNutrition = {
      calories: 10,
      protein: 1,
      carbs: 2,
      fat: 0.5,
      fiber: null,
      sugar: null,
      sodium: null,
    };

    expect(
      editMainNutrientValuesAfterServingPreview(
        currentValues,
        previewNutrition,
        true,
      ),
    ).toEqual(currentValues);
    expect(
      editMainNutrientValuesAfterServingPreview(
        currentValues,
        previewNutrition,
        false,
      ),
    ).toEqual({
      calories: '10',
      protein: '1',
      carbs: '2',
      fat: '0.5',
      fiber: '',
      sugar: '',
      sodium: '',
    });
  });
});
