import { describe, expect, it } from 'vitest';
import type { ServingChoice } from './serving-preview';
import { changeAiServingChoice } from './ai-serving';

describe('changeAiServingChoice', () => {
  it('makes a parsed quantity with no unit recoverable when a mass unit is chosen', () => {
    const state = {
      amount: '1',
      unit: '',
      servingOptionId: null,
      initialization: 'needs_review' as const,
      parsedQuantity: 1,
      wholeItemServingOptionId: null,
      wholeItemServing: null,
    };
    const choice: ServingChoice = {
      id: 'unit:g',
      label: 'g',
      unit: 'g',
      servingOptionId: null,
      quantity: 100,
    };

    expect(changeAiServingChoice(state, choice)).toMatchObject({
      amount: '1',
      unit: 'g',
      servingOptionId: null,
    });
  });
});
