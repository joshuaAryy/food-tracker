import {
  normalizeIdentityText,
  parseNullableNumber,
  type CanonicalNutrientUnit,
  type NormalizedProviderNutrient,
} from './normalized.js';

type Mapping = {
  key: string;
  unit: CanonicalNutrientUnit;
  multiplier?: number;
};

const MAPPINGS: Record<string, Mapping> = {
  calories: { key: 'calories', unit: 'kcal' },
  energy: { key: 'calories', unit: 'kcal' },
  protein: { key: 'protein', unit: 'g' },
  carbohydrates: { key: 'carbs', unit: 'g' },
  carbohydrate: { key: 'carbs', unit: 'g' },
  fat: { key: 'fat', unit: 'g' },
  fibre: { key: 'fiber', unit: 'g' },
  fiber: { key: 'fiber', unit: 'g' },
  sugars: { key: 'sugar', unit: 'g' },
  sugar: { key: 'sugar', unit: 'g' },
  sodium: { key: 'sodium', unit: 'mg' },
  potassium: { key: 'potassium', unit: 'mg' },
  calcium: { key: 'calcium', unit: 'mg' },
  iron: { key: 'iron', unit: 'mg' },
  magnesium: { key: 'magnesium', unit: 'mg' },
  phosphorus: { key: 'phosphorus', unit: 'mg' },
  zinc: { key: 'zinc', unit: 'mg' },
  'vitamin c': { key: 'vitaminC', unit: 'mg' },
  'vitamin d': { key: 'vitaminD', unit: 'mcg' },
  'vitamin a': { key: 'vitaminA', unit: 'mcg' },
  retinol: { key: 'vitaminA', unit: 'mcg' },
  thiamin: { key: 'thiamine', unit: 'mg' },
  thiamine: { key: 'thiamine', unit: 'mg' },
  riboflavin: { key: 'riboflavin', unit: 'mg' },
  niacin: { key: 'niacin', unit: 'mg' },
  'vitamin b6': { key: 'vitaminB6', unit: 'mg' },
  'vitamin b12': { key: 'vitaminB12', unit: 'mcg' },
  folate: { key: 'folate', unit: 'mcg' },
  pantothenic: { key: 'pantothenicAcid', unit: 'mg' },
  'vitamin e': { key: 'vitaminE', unit: 'mg' },
  'vitamin k': { key: 'vitaminK', unit: 'mcg' },
  selenium: { key: 'selenium', unit: 'mcg' },
  copper: { key: 'copper', unit: 'mg' },
  manganese: { key: 'manganese', unit: 'mg' },
  iodine: { key: 'iodine', unit: 'mcg' },
  cholesterol: { key: 'cholesterol', unit: 'mg' },
  alcohol: { key: 'alcohol', unit: 'g' },
  water: { key: 'water', unit: 'g' },
};

function mappingForLabel(label: string): Mapping | undefined {
  const normalized = normalizeIdentityText(label);
  const comparable = normalized
    .replace(/[()\-,/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Similar words do not imply equivalent nutrients; keep ambiguous chemical
  // bases and non-canonical fibre definitions unknown rather than guessing.
  if (
    /\b(equivalent|equivalents|nsp|non starch polysaccharide)\b/.test(
      comparable,
    )
  ) {
    return undefined;
  }
  const exact = MAPPINGS[comparable];
  if (exact !== undefined) return exact;
  const required = (key: string): Mapping => {
    const mapping = MAPPINGS[key];
    if (mapping === undefined)
      throw new Error(`Missing nutrient mapping: ${key}`);
    return mapping;
  };
  const candidates: Array<[string, Mapping]> = [
    ['energy', required('energy')],
    ['energie', required('energy')],
    ['energetique', required('energy')],
    ['calorie', required('calories')],
    ['protein', required('protein')],
    ['proteine', required('protein')],
    ['carbohydrate', required('carbohydrates')],
    ['glucide', required('carbohydrates')],
    ['fat', required('fat')],
    ['lipide', required('fat')],
    ['fibre', required('fiber')],
    ['fiber', required('fiber')],
    ['sugar', required('sugar')],
    ['sucre', required('sugar')],
    ['sodium', required('sodium')],
    ['calcium', required('calcium')],
    ['potassium', required('potassium')],
    ['iron', required('iron')],
    ['fer', required('iron')],
    ['magnesium', required('magnesium')],
    ['phosphor', required('phosphorus')],
    ['vitamin c', required('vitamin c')],
    ['vitamin d', required('vitamin d')],
    ['vitamin a', required('vitamin a')],
    ['retinol', required('retinol')],
    ['thiamin', required('thiamin')],
    ['thiamine', required('thiamine')],
    ['riboflavin', required('riboflavin')],
    ['niacin', required('niacin')],
    ['vitamin b6', required('vitamin b6')],
    ['vitamin b12', required('vitamin b12')],
    ['folate', required('folate')],
    ['pantothen', required('pantothenic')],
    ['vitamin e', required('vitamin e')],
    ['vitamin k', required('vitamin k')],
    ['selenium', required('selenium')],
    ['copper', required('copper')],
    ['cuivre', required('copper')],
    ['manganese', required('manganese')],
    ['iodine', required('iodine')],
    ['iode', required('iodine')],
    ['cholesterol', required('cholesterol')],
  ];
  return candidates.find(([term]) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^| )${escaped}(?: |$)`).test(comparable);
  })?.[1];
}

export function mapProviderNutrient(
  label: string,
  value: unknown,
  sourceUnit: string,
): NormalizedProviderNutrient | null {
  const amount = parseNullableNumber(value);
  if (amount === null) return null;
  const mapping = mappingForLabel(label);
  if (mapping === undefined) return null;
  const unit = normalizeIdentityText(sourceUnit)
    .replace(/^µg$/, 'mcg')
    .replace(/^ug$/, 'mcg');
  if (unit === 'international unit' || unit === 'iu') return null;
  let normalizedAmount = amount;
  if (mapping.unit === 'mg' && unit === 'g') normalizedAmount *= 1000;
  if (mapping.unit === 'mcg' && unit === 'mg') normalizedAmount *= 1000;
  if (mapping.unit === 'g' && unit === 'mg') normalizedAmount /= 1000;
  if (mapping.key === 'calories' && (unit === 'kj' || unit === 'kilojoule')) {
    normalizedAmount *= 0.239006;
  }
  return {
    key: mapping.key,
    amount: normalizedAmount,
    unit: mapping.unit,
    sourceLabel: label,
    sourceUnit,
    sourceValue: String(value),
  };
}
