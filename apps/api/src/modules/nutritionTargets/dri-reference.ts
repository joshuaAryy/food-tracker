import type { NutrientKey, NutrientUnit } from '@food-tracker/shared';
import type { Sex } from '@food-tracker/shared';
import {
  TARGETABLE_NUTRIENT_POLICY,
  type TargetDirection,
} from './effective-resolver.js';

export interface DriCompatibility {
  status: 'compatible' | 'unavailable';
  canonicalMeaning: string;
  referenceQuantity: string;
  unit: NutrientUnit;
  reason?: string;
}

const compatibleKeys = [
  'vitaminD',
  'calcium',
  'potassium',
  'iron',
  'magnesium',
  'phosphorus',
  'zinc',
  'selenium',
  'copper',
  'manganese',
  'iodine',
  'vitaminC',
  'thiamine',
  'riboflavin',
  'pantothenicAcid',
  'vitaminB6',
  'vitaminB12',
] as const;

const incompatible = (
  canonicalMeaning: string,
  referenceQuantity: string,
  unit: NutrientUnit,
  reason: string,
): DriCompatibility => ({
  status: 'unavailable',
  canonicalMeaning,
  referenceQuantity,
  unit,
  reason,
});

export const DRI_TARGET_COMPATIBILITY: Record<NutrientKey, DriCompatibility> = {
  vitaminA: incompatible(
    'provider-collapsed retinol/total vitamin A',
    'Vitamin A RAE',
    'mcg',
    'retinol and RAE are not interchangeable',
  ),
  folate: incompatible(
    'provider total folate',
    'Folate DFE',
    'mcg',
    'total folate is not proven equivalent to DFE',
  ),
  niacin: incompatible(
    'provider niacin',
    'Niacin equivalents (NE)',
    'mg',
    'niacin is not proven equivalent to NE',
  ),
  vitaminE: incompatible(
    'provider vitamin E',
    'alpha-tocopherol',
    'mg',
    'all providers do not guarantee alpha-tocopherol semantics',
  ),
  vitaminK: incompatible(
    'provider vitamin K',
    'Vitamin K',
    'mcg',
    'provider subtype semantics are not uniform',
  ),
  ...Object.fromEntries(
    compatibleKeys.map((key) => [
      key,
      {
        status: 'compatible',
        canonicalMeaning: key,
        referenceQuantity: key,
        unit: TARGETABLE_NUTRIENT_POLICY[key]?.unit ?? 'mg',
      },
    ]),
  ),
} as Record<NutrientKey, DriCompatibility>;

const referenceValues: Partial<
  Record<
    NutrientKey,
    {
      unit: NutrientUnit;
      direction: TargetDirection;
      adult: { male: number; female: number };
      adolescent: { male: number; female: number };
    }
  >
> = {
  vitaminD: {
    unit: 'mcg',
    direction: 'minimum',
    adult: { male: 15, female: 15 },
    adolescent: { male: 15, female: 15 },
  },
  calcium: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 1000, female: 1000 },
    adolescent: { male: 1300, female: 1300 },
  },
  potassium: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 3400, female: 2600 },
    adolescent: { male: 3000, female: 2300 },
  },
  vitaminC: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 90, female: 75 },
    adolescent: { male: 75, female: 65 },
  },
  thiamine: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 1.2, female: 1.1 },
    adolescent: { male: 1.2, female: 1 },
  },
  riboflavin: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 1.3, female: 1.1 },
    adolescent: { male: 1.3, female: 1 },
  },
  pantothenicAcid: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 5, female: 5 },
    adolescent: { male: 5, female: 5 },
  },
  vitaminB6: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 1.3, female: 1.3 },
    adolescent: { male: 1.3, female: 1.2 },
  },
  vitaminB12: {
    unit: 'mcg',
    direction: 'minimum',
    adult: { male: 2.4, female: 2.4 },
    adolescent: { male: 2.4, female: 2.4 },
  },
  iron: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 8, female: 18 },
    adolescent: { male: 11, female: 15 },
  },
  magnesium: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 400, female: 310 },
    adolescent: { male: 410, female: 360 },
  },
  phosphorus: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 700, female: 700 },
    adolescent: { male: 1250, female: 1250 },
  },
  zinc: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 11, female: 8 },
    adolescent: { male: 11, female: 9 },
  },
  selenium: {
    unit: 'mcg',
    direction: 'minimum',
    adult: { male: 55, female: 55 },
    adolescent: { male: 55, female: 55 },
  },
  copper: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 0.9, female: 0.9 },
    adolescent: { male: 0.89, female: 0.89 },
  },
  manganese: {
    unit: 'mg',
    direction: 'minimum',
    adult: { male: 2.3, female: 1.8 },
    adolescent: { male: 2.2, female: 1.6 },
  },
  iodine: {
    unit: 'mcg',
    direction: 'minimum',
    adult: { male: 150, female: 150 },
    adolescent: { male: 150, female: 150 },
  },
};

export function resolveDriReferenceTarget(
  nutrientKey: NutrientKey,
  completedAge: number,
  sex: Sex,
): {
  value: number;
  unit: NutrientUnit;
  direction: TargetDirection;
  source: 'reference';
  version: 'health_canada_dri_2023';
} | null {
  const compatibility = DRI_TARGET_COMPATIBILITY[nutrientKey];
  const reference = referenceValues[nutrientKey];
  if (compatibility?.status !== 'compatible' || reference === undefined)
    return null;
  // This table intentionally carries only the validated adolescent (14–18)
  // and adult (19+) rows. Younger users still receive age-appropriate energy
  // requirements and may set Custom targets, but we do not project an
  // adolescent value onto children without a reviewed source row.
  if (completedAge < 14) return null;
  const values = completedAge < 19 ? reference.adolescent : reference.adult;
  return {
    value: values[sex],
    unit: reference.unit,
    direction: reference.direction,
    source: 'reference',
    version: 'health_canada_dri_2023',
  };
}
