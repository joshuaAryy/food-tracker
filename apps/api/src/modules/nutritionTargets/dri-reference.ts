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
  /** Provider representations proven safe for this canonical quantity. */
  providers: readonly NutrientDataProvider[];
  reason?: string;
}

export type NutrientDataProvider =
  | 'cnf'
  | 'ciqual'
  | 'cofid'
  | 'usda_fdc'
  | 'open_food_facts';

const REFERENCE_SAFE_PROVIDERS: readonly NutrientDataProvider[] = [
  'cnf',
  'ciqual',
  'cofid',
  'usda_fdc',
  'open_food_facts',
];
const VITAMIN_D_SAFE_PROVIDERS: readonly NutrientDataProvider[] = [
  'cnf',
  'ciqual',
  'cofid',
  'usda_fdc',
];

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
  providers: [],
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
        canonicalMeaning:
          key === 'vitaminD'
            ? 'total vitamin D (D2 + D3)'
            : key === 'calcium'
              ? 'total dietary calcium'
              : key === 'potassium'
                ? 'total dietary potassium'
                : key,
        referenceQuantity:
          key === 'vitaminD'
            ? 'Vitamin D RDA/AI (mcg D2 + D3)'
            : key === 'calcium'
              ? 'Calcium RDA/AI (mg)'
              : key === 'potassium'
                ? 'Potassium AI (mg)'
                : key,
        unit: TARGETABLE_NUTRIENT_POLICY[key]?.unit ?? 'mg',
        providers:
          key === 'vitaminD'
            ? VITAMIN_D_SAFE_PROVIDERS
            : REFERENCE_SAFE_PROVIDERS,
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

type ChildBand = '1_3' | '4_8' | '9_13';
const childBandValues: Partial<
  Record<NutrientKey, Record<ChildBand, { male: number; female: number }>>
> = {
  vitaminD: {
    '1_3': { male: 15, female: 15 },
    '4_8': { male: 15, female: 15 },
    '9_13': { male: 15, female: 15 },
  },
  calcium: {
    '1_3': { male: 700, female: 700 },
    '4_8': { male: 1000, female: 1000 },
    '9_13': { male: 1300, female: 1300 },
  },
  potassium: {
    '1_3': { male: 2000, female: 2000 },
    '4_8': { male: 2300, female: 2300 },
    '9_13': { male: 2500, female: 2300 },
  },
};

type AdultBand = '19_30' | '31_50' | '51_70' | 'over_70';
const adultBandValues: Partial<
  Record<NutrientKey, Record<AdultBand, { male: number; female: number }>>
> = {
  vitaminD: {
    '19_30': { male: 15, female: 15 },
    '31_50': { male: 15, female: 15 },
    '51_70': { male: 15, female: 15 },
    over_70: { male: 20, female: 20 },
  },
  calcium: {
    '19_30': { male: 1000, female: 1000 },
    '31_50': { male: 1000, female: 1000 },
    '51_70': { male: 1000, female: 1200 },
    over_70: { male: 1200, female: 1200 },
  },
  vitaminC: {
    '19_30': { male: 90, female: 75 },
    '31_50': { male: 90, female: 75 },
    '51_70': { male: 90, female: 75 },
    over_70: { male: 90, female: 75 },
  },
  vitaminB6: {
    '19_30': { male: 1.3, female: 1.3 },
    '31_50': { male: 1.3, female: 1.3 },
    '51_70': { male: 1.7, female: 1.5 },
    over_70: { male: 1.7, female: 1.5 },
  },
  magnesium: {
    '19_30': { male: 400, female: 310 },
    '31_50': { male: 420, female: 320 },
    '51_70': { male: 420, female: 320 },
    over_70: { male: 420, female: 320 },
  },
  iron: {
    '19_30': { male: 8, female: 18 },
    '31_50': { male: 8, female: 18 },
    '51_70': { male: 8, female: 8 },
    over_70: { male: 8, female: 8 },
  },
};

function adultBand(age: number): AdultBand {
  if (age <= 30) return '19_30';
  if (age <= 50) return '31_50';
  if (age <= 70) return '51_70';
  return 'over_70';
}

function childBand(age: number): ChildBand | null {
  if (age <= 3) return '1_3';
  if (age <= 8) return '4_8';
  if (age <= 13) return '9_13';
  return null;
}

/**
 * Automatic references are only valid for provider rows whose normalized
 * mapping preserves the DRI quantity (not merely its display unit). FoodLog
 * snapshots retain the source FoodItem relationship, so recommendation facts
 * enforce this registry against provider and source-type provenance while
 * retaining incompatible values for ordinary tracking.
 */
export function isDriProviderCompatible(
  nutrientKey: NutrientKey,
  provider: string,
): boolean {
  return (
    DRI_TARGET_COMPATIBILITY[nutrientKey]?.providers.includes(
      provider as NutrientDataProvider,
    ) ?? false
  );
}

/**
 * Manual/first-party snapshots do not carry an external provider identity and
 * are already expressed in the canonical unit. Unknown external providers are
 * intentionally not trusted for automatic DRI comparisons.
 */
export function isDriDataComparable(
  nutrientKey: NutrientKey,
  provider: string | null | undefined,
  unit?: string | null,
  sourceType?: 'app_owned' | 'user_custom' | 'cached_external',
): boolean {
  const compatibility = DRI_TARGET_COMPATIBILITY[nutrientKey];
  if (
    unit !== undefined &&
    unit !== null &&
    compatibility !== undefined &&
    compatibility.unit !== unit
  )
    return false;
  if (provider === 'manual') return true;
  if (provider === null || provider === undefined) {
    // A null provider is only safe when the FoodItem explicitly identifies a
    // first-party/manual source. Legacy or ambiguous cached rows must not be
    // promoted into an authoritative DRI comparison by unit alone.
    return sourceType === 'app_owned' || sourceType === 'user_custom';
  }
  return isDriProviderCompatible(nutrientKey, provider);
}

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
  if (completedAge < 1) return null;
  const values =
    completedAge < 14
      ? childBandValues[nutrientKey]?.[childBand(completedAge) ?? '1_3']
      : completedAge < 19
        ? reference.adolescent
        : (adultBandValues[nutrientKey]?.[adultBand(completedAge)] ??
          reference.adult);
  if (values === undefined) return null;
  return {
    value: values[sex],
    unit: reference.unit,
    direction: reference.direction,
    source: 'reference',
    version: 'health_canada_dri_2023',
  };
}
