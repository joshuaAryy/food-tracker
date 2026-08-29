import { describe, expect, it } from 'vitest';
import {
  TARGETABLE_NUTRIENT_POLICY,
  resolveEffectiveNutritionTargets,
} from '../src/modules/nutritionTargets/effective-resolver.js';

describe('targetable nutrient and effective target policy', () => {
  it('does not target every catalog nutrient', () => {
    expect(TARGETABLE_NUTRIENT_POLICY.oxalate).toBeUndefined();
    expect(TARGETABLE_NUTRIENT_POLICY.folate).toBeUndefined();
    expect(TARGETABLE_NUTRIENT_POLICY.vitaminD?.direction).toBe('minimum');
  });

  it('prefers a user override while retaining the recommended value', () => {
    const result = resolveEffectiveNutritionTargets({
      recommended: {
        calories: { value: 2180, unit: 'kcal', direction: 'target', source: 'personalized' },
      },
      overrides: [{ nutrientKey: 'calories', value: 2300, origin: 'legacy_preserved' }],
    });

    expect(result.calories).toMatchObject({
      recommendedValue: 2180,
      effectiveValue: 2300,
      effectiveSource: 'user',
      overrideOrigin: 'legacy_preserved',
    });
  });

  it('returns missing when a reference is semantically incompatible', () => {
    const result = resolveEffectiveNutritionTargets({
      recommended: {
        folate: { value: null, unit: 'mcg', direction: 'minimum', source: 'missing' },
      },
      overrides: [],
    });

    expect(result.folate?.effectiveValue).toBeNull();
    expect(result.folate?.effectiveSource).toBe('missing');
  });
});
