import type { NutrientKey, NutrientUnit } from '@food-tracker/shared';

export type TargetDirection = 'target' | 'minimum' | 'limit';
export type TargetSource =
  | 'user'
  | 'personalized'
  | 'reference'
  | 'derived'
  | 'missing';

export interface TargetPolicyEntry {
  unit: NutrientUnit;
  direction: TargetDirection;
  mode: 'simple' | 'complex';
}

export const TARGETABLE_NUTRIENT_POLICY: Partial<
  Record<NutrientKey, TargetPolicyEntry>
> = {
  calories: { unit: 'kcal', direction: 'target', mode: 'simple' },
  protein: { unit: 'g', direction: 'minimum', mode: 'simple' },
  carbs: { unit: 'g', direction: 'target', mode: 'simple' },
  fat: { unit: 'g', direction: 'target', mode: 'simple' },
  fiber: { unit: 'g', direction: 'minimum', mode: 'simple' },
  sugar: { unit: 'g', direction: 'limit', mode: 'simple' },
  sodium: { unit: 'mg', direction: 'limit', mode: 'simple' },
  vitaminD: { unit: 'mcg', direction: 'minimum', mode: 'complex' },
  calcium: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  potassium: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  iron: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  magnesium: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  phosphorus: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  zinc: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  selenium: { unit: 'mcg', direction: 'minimum', mode: 'complex' },
  copper: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  manganese: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  iodine: { unit: 'mcg', direction: 'minimum', mode: 'complex' },
  vitaminC: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  thiamine: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  riboflavin: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  pantothenicAcid: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  vitaminB6: { unit: 'mg', direction: 'minimum', mode: 'complex' },
  vitaminB12: { unit: 'mcg', direction: 'minimum', mode: 'complex' },
};

export interface RecommendedTarget {
  value: number | null;
  unit: NutrientUnit;
  direction: TargetDirection;
  source: Exclude<TargetSource, 'user'>;
}

export interface TargetOverride {
  nutrientKey: NutrientKey;
  value: number;
  origin: 'user' | 'legacy_preserved';
}

export interface EffectiveTarget extends Omit<
  RecommendedTarget,
  'source' | 'value'
> {
  nutrientKey: NutrientKey;
  recommendedValue: number | null;
  recommendedSource: Exclude<TargetSource, 'user'>;
  effectiveValue: number | null;
  effectiveSource: TargetSource;
  source: TargetSource;
  value: number | null;
  isCustom: boolean;
  overrideOrigin?: TargetOverride['origin'];
}

export function resolveEffectiveNutritionTargets(input: {
  recommended: Partial<Record<NutrientKey, RecommendedTarget>>;
  overrides: readonly TargetOverride[];
}): Record<string, EffectiveTarget> {
  const byKey = new Map(
    input.overrides.map((override) => [override.nutrientKey, override]),
  );
  const result: Record<string, EffectiveTarget> = {};

  for (const [key, recommended] of Object.entries(input.recommended)) {
    if (recommended === undefined) continue;
    const nutrientKey = key as NutrientKey;
    const override = byKey.get(nutrientKey);
    const policy = TARGETABLE_NUTRIENT_POLICY[nutrientKey];
    const direction = policy?.direction ?? recommended.direction;
    const unit = policy?.unit ?? recommended.unit;
    const effectiveSource =
      override === undefined ? recommended.source : 'user';
    result[key] = {
      nutrientKey,
      unit,
      direction,
      value: override?.value ?? recommended.value,
      recommendedValue: recommended.value,
      recommendedSource: recommended.source,
      effectiveValue: override?.value ?? recommended.value,
      effectiveSource,
      source: effectiveSource,
      isCustom: override !== undefined,
      ...(override === undefined ? {} : { overrideOrigin: override.origin }),
    };
  }
  return result;
}
