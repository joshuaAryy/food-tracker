import { describe, expect, it } from 'vitest';
import {
  TARGETABLE_NUTRIENT_POLICY,
  resolveEffectiveNutritionTargets,
} from '../src/modules/nutritionTargets/effective-resolver.js';
import { reportingGoalsFromEffectiveTargets } from '../src/modules/nutritionTargets/reporting-adapter.js';
import { targetRows } from '../src/modules/nutritionTargets/routes.js';

describe('targetable nutrient and effective target policy', () => {
  it('projects only effective targets without inventing unsupported defaults', () => {
    const effective = resolveEffectiveNutritionTargets({
      recommended: {
        calories: {
          value: 2100,
          unit: 'kcal',
          direction: 'target',
          source: 'personalized',
        },
      },
      overrides: [],
    });
    expect(reportingGoalsFromEffectiveTargets(effective)).toEqual({
      calories: {
        value: 2100,
        unit: 'kcal',
        direction: 'target',
        source: 'personalized',
      },
    });
  });

  it('does not target every catalog nutrient', () => {
    expect(TARGETABLE_NUTRIENT_POLICY.oxalate).toBeUndefined();
    expect(TARGETABLE_NUTRIENT_POLICY.folate).toBeUndefined();
    expect(TARGETABLE_NUTRIENT_POLICY.vitaminD?.direction).toBe('minimum');
  });

  it('prefers a user override while retaining the recommended value', () => {
    const result = resolveEffectiveNutritionTargets({
      recommended: {
        calories: {
          value: 2180,
          unit: 'kcal',
          direction: 'target',
          source: 'personalized',
        },
      },
      overrides: [
        { nutrientKey: 'calories', value: 2300, origin: 'legacy_preserved' },
      ],
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
        folate: {
          value: null,
          unit: 'mcg',
          direction: 'minimum',
          source: 'missing',
        },
      },
      overrides: [],
    });

    expect(result.folate?.effectiveValue).toBeNull();
    expect(result.folate?.effectiveSource).toBe('missing');
  });

  it('keeps a custom target visible when the automatic reference is unavailable', () => {
    const result = resolveEffectiveNutritionTargets({
      recommended: {},
      overrides: [{ nutrientKey: 'calcium', value: 900, origin: 'user' }],
    });

    expect(result.calcium).toMatchObject({
      recommendedValue: null,
      effectiveValue: 900,
      effectiveSource: 'user',
      direction: 'minimum',
      isCustom: true,
    });
  });

  it('projects mutation responses to the same target-row array as GET', () => {
    const rows = targetRows({
      calories: {
        nutrientKey: 'calories',
        unit: 'kcal',
        direction: 'target',
        recommendedValue: 2180,
        effectiveValue: 2300,
        effectiveSource: 'user',
        recommendedSource: 'personalized',
        source: 'user',
        value: 2300,
        isCustom: true,
        overrideOrigin: 'user',
      },
      oxalate: {
        nutrientKey: 'oxalate',
        unit: 'mg',
        direction: 'target',
        recommendedValue: null,
        effectiveValue: null,
        effectiveSource: 'missing',
        recommendedSource: 'missing',
        source: 'missing',
        value: null,
        isCustom: false,
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.nutrientKey).toBe('calories');
  });

  it('keeps complex-only targets out of simple mode', () => {
    const targets = {
      calories: {
        nutrientKey: 'calories' as const,
        unit: 'kcal' as const,
        direction: 'target' as const,
        recommendedValue: 2100,
        effectiveValue: 2100,
        effectiveSource: 'personalized' as const,
        recommendedSource: 'personalized' as const,
        source: 'personalized' as const,
        value: 2100,
        isCustom: false,
      },
      vitaminD: {
        nutrientKey: 'vitaminD' as const,
        unit: 'mcg' as const,
        direction: 'minimum' as const,
        recommendedValue: 15,
        effectiveValue: 15,
        effectiveSource: 'reference' as const,
        recommendedSource: 'reference' as const,
        source: 'reference' as const,
        value: 15,
        isCustom: false,
      },
    };

    expect(targetRows(targets, 'simple').map((row) => row.nutrientKey)).toEqual(
      ['calories'],
    );
    expect(
      targetRows(targets, 'complex').map((row) => row.nutrientKey),
    ).toEqual(['calories', 'vitaminD']);
  });
});
