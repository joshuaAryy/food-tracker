import { describe, expect, it } from 'vitest';
import { scoreFoodCandidate } from '../src/modules/foodItems/candidate-ranking.js';

const candidate = (overrides: Record<string, unknown> = {}) => ({
  name: 'Egg, chicken, whole, raw',
  authoritativeAliases: [
    'Œuf de poule entier cru',
    'Gallus gallus domesticus ovum',
  ],
  brandName: null,
  foodType: 'generic' as const,
  source: 'reference' as const,
  calories: 143,
  protein: 12,
  carbs: 1,
  fat: 10,
  fiber: null,
  sugar: null,
  sodium: 100,
  nutrientCount: 4,
  servingQuantity: 100,
  servingUnit: 'g',
  servingWeightGrams: 100,
  ...overrides,
});

describe('authoritative alias deterministic identity', () => {
  it.each(['œuf', 'oeuf', 'gallus gallus domesticus'])(
    'accepts %s as identity evidence',
    (query) => {
      const score = scoreFoodCandidate({ query, candidate: candidate() });
      expect(score.visibleRelevant).toBe(true);
      expect(score.strongIdentityMatch).toBe(true);
    },
  );

  it('does not let a matching alias bypass preparation or trusted safety', () => {
    const score = scoreFoodCandidate({
      query: 'oeuf grilled',
      candidate: candidate(),
    });
    expect(score.selectionEligible).toBe(false);
    expect(score.allRequestedDescriptorsMatch).toBe(false);
  });

  it('does not use category-only metadata as identity evidence', () => {
    const score = scoreFoodCandidate({
      query: 'vegetable',
      candidate: candidate({
        name: 'Egg, chicken, whole, raw',
        authoritativeAliases: [],
      }),
    });
    expect(score.visibleRelevant).toBe(false);
  });
});
