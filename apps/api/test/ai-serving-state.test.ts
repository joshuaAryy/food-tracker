import { describe, expect, it } from 'vitest';
import type {
  AiFoodParseExternalFood,
  AiFoodParsedItem,
  FoodItem,
} from '@food-tracker/shared';
import {
  aiServingPreview,
  availableAiServingChoices,
  changeAiCandidateServing,
  initialAiServingState,
} from '../../mobile/src/lib/ai-serving.js';

const foodItem = {
  id: 'food-1',
  name: 'Eggs',
  servingQuantity: 100,
  servingUnit: 'g',
  servingWeightGrams: 100,
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
  calories: 140,
  protein: 12,
  carbs: null,
  fat: null,
  fiber: null,
  sugar: null,
  sodium: null,
  nutrients: {},
} as unknown as FoodItem;

const item = {
  id: 'item-1',
  parsedName: 'eggs',
  quantityText: '2',
  servingText: '2 eggs',
  servingSuggestion: {
    status: 'parsed',
    quantity: 2,
    unit: 'egg',
    rawQuantityText: '2',
    rawServingText: '2 eggs',
  },
  reviewStatus: 'matched',
  loggable: true,
  selectedCandidateId: foodItem.id,
  candidates: [],
} as unknown as AiFoodParsedItem;

describe('AI serving state', () => {
  it('initializes seven apples as 1400 g from the candidate whole-item metadata', () => {
    const apples = {
      ...foodItem,
      defaultWholeItemServing: {
        optionId: 'apple-medium',
        label: '1 medium Apple',
        quantity: 1,
        unit: 'medium_item',
        equivalentWeightGrams: 200,
        equivalentVolumeMl: null,
      },
      servingOptions: {
        schemaVersion: 1,
        options: [
          {
            id: 'apple-medium',
            label: '1 medium Apple',
            quantity: 1,
            unit: 'medium_item',
            unitFamily: 'household',
            equivalentWeightGrams: 200,
            equivalentVolumeMl: null,
            source: 'provider',
            trust: 'trusted',
            provider: 'usda_fdc',
            providerDescription: '1 medium Apple',
          },
        ],
      },
    } as FoodItem;
    const quantityOnly = {
      ...item,
      quantityText: '7',
      servingText: 'apples',
      servingSuggestion: {
        status: 'needs_review',
        quantity: 7,
        unit: null,
        reason: 'unsupported_serving_text',
        rawQuantityText: '7',
        rawServingText: 'apples',
      },
    } as unknown as AiFoodParsedItem;

    const state = initialAiServingState(quantityOnly, apples);

    expect(state).toMatchObject({
      amount: '1400',
      unit: 'g',
      servingOptionId: null,
      parsedQuantity: 7,
      wholeItemServingOptionId: 'apple-medium',
    });
    expect(aiServingPreview(apples, state)).toMatchObject({
      status: 'exact',
      requestedServing: { quantity: 1400, unit: 'g', servingOptionId: null },
    });
    for (const unit of ['g', 'kg', 'oz', 'lb'] as const) {
      const choices = availableAiServingChoices(apples, {
        ...state,
        unit,
      });
      expect(choices.map((choice) => choice.unit)).toEqual([
        'g',
        'kg',
        'oz',
        'lb',
      ]);
      expect(choices).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            unit: 'medium_item',
            servingOptionId: 'apple-medium',
          }),
        ]),
      );
    }
    expect(state.wholeItemServing).toMatchObject({
      optionId: 'apple-medium',
      equivalentWeightGrams: 200,
    });
  });

  it('keeps physical choices available when a candidate has no serving options', () => {
    const candidate = {
      ...foodItem,
      servingOptions: null,
      defaultWholeItemServing: null,
    } as FoodItem;
    const quantityOnly = {
      ...item,
      quantityText: '7',
      servingText: 'apples',
      servingSuggestion: {
        status: 'needs_review',
        quantity: 7,
        unit: null,
        reason: 'unsupported_serving_text',
        rawQuantityText: '7',
        rawServingText: 'apples',
      },
    } as unknown as AiFoodParsedItem;
    const state = initialAiServingState(quantityOnly, candidate);

    expect(state).toMatchObject({ amount: '7', unit: '', parsedQuantity: 7 });
    expect(
      availableAiServingChoices(candidate, state).map((choice) => choice.unit),
    ).toEqual(['g', 'kg', 'oz', 'lb']);
    const physicalState = { ...state, amount: '150', unit: 'g' };
    expect(aiServingPreview(candidate, physicalState)).toMatchObject({
      status: 'exact',
      requestedServing: { quantity: 150, unit: 'g', servingOptionId: null },
    });
  });

  it('reinitializes seven apples from the replacement candidate metadata', () => {
    const first = {
      ...foodItem,
      defaultWholeItemServing: {
        optionId: 'apple-200',
        label: '1 medium Apple',
        quantity: 1,
        unit: 'medium_item',
        equivalentWeightGrams: 200,
        equivalentVolumeMl: null,
      },
    } as FoodItem;
    const replacement = {
      ...foodItem,
      id: 'food-2',
      defaultWholeItemServing: {
        optionId: 'apple-180',
        label: '1 medium Apple',
        quantity: 1,
        unit: 'medium_item',
        equivalentWeightGrams: 180,
        equivalentVolumeMl: null,
      },
    } as FoodItem;
    const quantityOnly = {
      ...item,
      quantityText: '7',
      servingText: 'apples',
      servingSuggestion: {
        status: 'needs_review',
        quantity: 7,
        unit: null,
        reason: 'unsupported_serving_text',
        rawQuantityText: '7',
        rawServingText: 'apples',
      },
    } as unknown as AiFoodParsedItem;
    const previous = initialAiServingState(quantityOnly, first);

    const next = changeAiCandidateServing(previous, replacement);

    expect(next).toMatchObject({
      amount: '1260',
      unit: 'g',
      servingOptionId: null,
      parsedQuantity: 7,
      wholeItemServingOptionId: 'apple-180',
    });
    expect(aiServingPreview(replacement, next)?.requestedServing).toEqual({
      quantity: 1260,
      unit: 'g',
      servingOptionId: null,
    });
  });
  it('resolves quantity-only apples through the selected candidate medium-item option', () => {
    const apples = {
      ...foodItem,
      name: 'Apples',
      defaultWholeItemServing: {
        optionId: 'apple-medium',
        label: '1 medium apple',
        quantity: 1,
        unit: 'medium_item',
        equivalentWeightGrams: 182,
        equivalentVolumeMl: null,
      },
      servingOptions: {
        schemaVersion: 1,
        options: [
          {
            id: 'apple-medium',
            label: '1 medium apple',
            quantity: 1,
            unit: 'medium_item',
            unitFamily: 'household',
            equivalentWeightGrams: 182,
            equivalentVolumeMl: null,
            source: 'provider',
            trust: 'trusted',
            provider: 'usda_fdc',
            providerDescription: '1 medium apple',
          },
        ],
      },
    } as FoodItem;
    const quantityOnly = {
      ...item,
      parsedName: 'apples',
      quantityText: '7',
      servingText: null,
      servingSuggestion: {
        status: 'needs_review',
        quantity: 7,
        unit: null,
        reason: 'missing_unit',
        rawQuantityText: '7',
        rawServingText: null,
      },
    } as unknown as AiFoodParsedItem;
    const state = initialAiServingState(quantityOnly, apples);
    expect(state).toMatchObject({
      amount: '1274',
      unit: 'g',
      servingOptionId: null,
    });
    expect(aiServingPreview(apples, state)).toMatchObject({
      status: 'exact',
      requestedServing: {
        quantity: 1274,
        unit: 'g',
        servingOptionId: null,
      },
    });
  });

  it('resolves the real external-candidate shape after asynchronous candidate arrival', () => {
    const externalFood: AiFoodParseExternalFood = {
      sourceProvider: 'usda_fdc',
      sourceId: '123',
      name: 'Apples, raw',
      brandName: null,
      foodType: 'generic',
      servingBasisText: '100 g',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      defaultWholeItemServing: {
        optionId: 'provider:usda_fdc:123:medium_item:1:182',
        label: '1 medium apple',
        quantity: 1,
        unit: 'medium_item',
        equivalentWeightGrams: 182,
        equivalentVolumeMl: null,
      },
      servingOptions: {
        schemaVersion: 1,
        options: [
          {
            id: 'provider:usda_fdc:123:medium_item:1:182',
            label: '1 medium apple',
            quantity: 1,
            unit: 'medium_item',
            unitFamily: 'household',
            equivalentWeightGrams: 182,
            equivalentVolumeMl: null,
            source: 'provider',
            trust: 'trusted',
            provider: 'usda_fdc',
            providerDescription: '1 medium apple',
          },
        ],
      },
      calories: 52,
      protein: 0.3,
      carbs: 14,
      fat: 0.2,
      fiber: 2.4,
      sugar: 10,
      sodium: 1,
      nutrients: {},
    };
    const candidate = {
      candidateType: 'external_food' as const,
      foodItem: null,
      externalFood,
      rank: 1,
      matchReason: 'usda_fdc' as const,
      confidence: 'medium' as const,
      defaultServingMultiplier: 1,
    };
    const quantityOnly = {
      ...item,
      quantityText: '7',
      servingText: null,
      servingSuggestion: {
        status: 'needs_review',
        quantity: 7,
        unit: null,
        reason: 'missing_unit',
        rawQuantityText: '7',
        rawServingText: null,
      },
    } as unknown as AiFoodParsedItem;

    const pending = initialAiServingState(quantityOnly, null);
    const resolved = changeAiCandidateServing(pending, externalFood);

    expect(pending).toMatchObject({ amount: '7', unit: '' });
    expect(resolved).toMatchObject({
      amount: '1274',
      unit: 'g',
      servingOptionId: null,
    });
    expect(aiServingPreview(externalFood, resolved)).toMatchObject({
      status: 'exact',
      requestedServing: {
        quantity: 1274,
        unit: 'g',
        servingOptionId: null,
      },
    });
    expect(candidate.externalFood.servingOptions?.options).toHaveLength(1);
  });

  it('builds the trusted request shape for seven apples without client nutrition fields', () => {
    const apples = {
      ...foodItem,
      name: 'Apple, raw',
      defaultWholeItemServing: {
        optionId: 'provider:usda_fdc:2709215:medium_item:1:200',
        label: '1 medium Apple',
        quantity: 1,
        unit: 'medium_item',
        equivalentWeightGrams: 200,
        equivalentVolumeMl: null,
      },
      servingOptions: {
        schemaVersion: 1,
        options: [
          {
            ...foodItem.servingOptions!.options[0],
            id: 'provider:usda_fdc:2709215:medium_item:1:200',
            label: '1 medium Apple',
            unit: 'medium_item',
            unitFamily: 'household',
            equivalentWeightGrams: 200,
          },
        ],
      },
      calories: 61,
      protein: 0.2,
    } as FoodItem;
    const quantityOnly = {
      ...item,
      parsedName: 'apples',
      quantityText: '7',
      servingText: 'apples',
      servingSuggestion: {
        status: 'needs_review',
        quantity: 7,
        unit: null,
        reason: 'unsupported_serving_text',
        rawQuantityText: '7',
        rawServingText: 'apples',
      },
    } as unknown as AiFoodParsedItem;
    const state = initialAiServingState(quantityOnly, apples);
    const preview = aiServingPreview(apples, state);

    expect(preview?.requestedServing).toEqual({
      quantity: 1400,
      unit: 'g',
      servingOptionId: null,
    });
    expect(preview?.status).toBe('exact');
    expect({
      serving: preview?.requestedServing,
    }).toEqual({
      serving: {
        quantity: 1400,
        unit: 'g',
        servingOptionId: null,
      },
    });
    expect(preview).not.toHaveProperty('calories');
    expect(preview).not.toHaveProperty('nutrients');
  });
  it('initializes parsed quantity and resolves it against the candidate', () => {
    const state = initialAiServingState(item, foodItem);

    expect(state).toEqual({
      amount: '2',
      unit: 'egg',
      servingOptionId: 'egg-50g',
      initialization: 'parsed',
    });
    expect(aiServingPreview(foodItem, state)).toMatchObject({
      status: 'converted',
      multiplier: 1,
      requestedServing: {
        quantity: 2,
        unit: 'egg',
        servingOptionId: 'egg-50g',
      },
    });
  });

  it('initializes explicit eggs as grams when candidate metadata provides the trusted weight', () => {
    const eggs = {
      ...foodItem,
      defaultWholeItemServing: {
        optionId: 'egg-50g',
        label: '1 egg',
        quantity: 1,
        unit: 'egg',
        equivalentWeightGrams: 50,
        equivalentVolumeMl: null,
      },
    } as FoodItem;
    const threeEggs = {
      ...item,
      quantityText: '3',
      servingText: '3 eggs',
      servingSuggestion: {
        status: 'parsed',
        quantity: 3,
        unit: 'egg',
        rawQuantityText: '3',
        rawServingText: '3 eggs',
      },
    } as unknown as AiFoodParsedItem;

    expect(initialAiServingState(threeEggs, eggs)).toMatchObject({
      amount: '150',
      unit: 'g',
      servingOptionId: null,
      wholeItemServingOptionId: 'egg-50g',
    });
  });

  it('requires review when multiple trusted count options match', () => {
    const ambiguous = {
      ...foodItem,
      servingOptions: {
        ...foodItem.servingOptions!,
        options: [
          foodItem.servingOptions!.options[0],
          {
            ...foodItem.servingOptions!.options[0],
            id: 'egg-60g',
            equivalentWeightGrams: 60,
          },
        ],
      },
    } as FoodItem;
    const state = initialAiServingState(item, ambiguous);
    expect(state.servingOptionId).toBeNull();
    expect(aiServingPreview(ambiguous, state)?.status).toBe('needs_review');
  });

  it('auto-selects the replacement candidate unique count option', () => {
    const previous = {
      ...initialAiServingState(item, foodItem),
      servingOptionId: null,
    };
    const next = changeAiCandidateServing(previous, foodItem);
    expect(next.servingOptionId).toBe('egg-50g');
  });

  it('uses the candidate basis only when the parser reported no serving', () => {
    const missingItem = {
      ...item,
      quantityText: null,
      servingText: null,
      servingSuggestion: {
        status: 'missing',
        quantity: null,
        unit: null,
        rawQuantityText: null,
        rawServingText: null,
        reason: 'no_explicit_serving',
      },
    } as AiFoodParsedItem;

    expect(initialAiServingState(missingItem, foodItem)).toEqual({
      amount: '100',
      unit: 'g',
      servingOptionId: null,
      initialization: 'basis_default',
    });
  });

  it('preserves amount and unit but clears an option unavailable to a new candidate', () => {
    const previous = {
      amount: '2',
      unit: 'egg',
      servingOptionId: 'egg-50g',
      initialization: 'parsed' as const,
    };

    expect(
      changeAiCandidateServing(previous, {
        ...foodItem,
        id: 'food-2',
        servingOptions: null,
      }),
    ).toEqual({
      ...previous,
      servingOptionId: null,
    });
  });

  it('keeps a selected option when the replacement candidate exposes the same trusted option', () => {
    const previous = {
      amount: '2',
      unit: 'egg',
      servingOptionId: 'egg-50g',
      initialization: 'parsed' as const,
    };

    expect(
      changeAiCandidateServing(previous, { ...foodItem, id: 'food-2' }),
    ).toEqual(previous);
  });

  it('does not produce a trusted preview without a candidate', () => {
    expect(
      aiServingPreview(null, {
        amount: '2',
        unit: 'egg',
        servingOptionId: null,
        initialization: 'parsed',
      }),
    ).toBeNull();
  });
});
