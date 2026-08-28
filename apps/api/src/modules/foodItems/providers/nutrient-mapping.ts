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

function ciqualHeaderKey(label: string): string {
  return normalizeIdentityText(label)
    .replace(/\s*\((?:kcal|kj|mg|mcg|ug|μg|g)(?:\s*100\s*g)?\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CIQUAL_MAPPINGS = new Map<string, Mapping>([
  // Ciqual's EU kcal field is the preferred energy representation. The kJ,
  // Jones-factor, and Jones-factor-with-fibres alternatives are intentionally
  // excluded so column order cannot choose a different canonical value.
  [
    ciqualHeaderKey('Energy, Regulation EU No 1169 2011'),
    { key: 'calories', unit: 'kcal' },
  ],
  [
    ciqualHeaderKey('Energie, Reglement UE N° 1169 2011'),
    { key: 'calories', unit: 'kcal' },
  ],
  [ciqualHeaderKey('Energy'), { key: 'calories', unit: 'kcal' }],
  [ciqualHeaderKey('Energie'), { key: 'calories', unit: 'kcal' }],
  [ciqualHeaderKey('Protein'), { key: 'protein', unit: 'g' }],
  [
    ciqualHeaderKey('Proteines, N x facteur de Jones'),
    { key: 'protein', unit: 'g' },
  ],
  [ciqualHeaderKey('Carbohydrate'), { key: 'carbs', unit: 'g' }],
  [ciqualHeaderKey('Glucides'), { key: 'carbs', unit: 'g' }],
  [ciqualHeaderKey('Fat'), { key: 'fat', unit: 'g' }],
  [ciqualHeaderKey('Lipides'), { key: 'fat', unit: 'g' }],
  [ciqualHeaderKey('Sugars'), { key: 'sugar', unit: 'g' }],
  [ciqualHeaderKey('Sucres'), { key: 'sugar', unit: 'g' }],
  [ciqualHeaderKey('Fibres'), { key: 'fiber', unit: 'g' }],
  [ciqualHeaderKey('Fibres alimentaires'), { key: 'fiber', unit: 'g' }],
  [ciqualHeaderKey('Water'), { key: 'water', unit: 'g' }],
  [ciqualHeaderKey('Eau'), { key: 'water', unit: 'g' }],
  [ciqualHeaderKey('Starch'), { key: 'starch', unit: 'g' }],
  [ciqualHeaderKey('Amidon'), { key: 'starch', unit: 'g' }],
  [ciqualHeaderKey('Polyols'), { key: 'sugarAlcohol', unit: 'g' }],
  [ciqualHeaderKey('Polyols totaux'), { key: 'sugarAlcohol', unit: 'g' }],
  [ciqualHeaderKey('Alcohol'), { key: 'alcohol', unit: 'g' }],
  [ciqualHeaderKey('Alcool (ethanol)'), { key: 'alcohol', unit: 'g' }],
  [ciqualHeaderKey('FA saturated'), { key: 'saturatedFat', unit: 'g' }],
  [ciqualHeaderKey('AG satures'), { key: 'saturatedFat', unit: 'g' }],
  [ciqualHeaderKey('FA mono'), { key: 'monounsaturatedFat', unit: 'g' }],
  [
    ciqualHeaderKey('AG monoinsatures'),
    { key: 'monounsaturatedFat', unit: 'g' },
  ],
  [ciqualHeaderKey('FA poly'), { key: 'polyunsaturatedFat', unit: 'g' }],
  [
    ciqualHeaderKey('AG polyinsatures'),
    { key: 'polyunsaturatedFat', unit: 'g' },
  ],
  [ciqualHeaderKey('Cholesterol'), { key: 'cholesterol', unit: 'mg' }],
  [ciqualHeaderKey('Calcium'), { key: 'calcium', unit: 'mg' }],
  [ciqualHeaderKey('Chloride'), { key: 'chloride', unit: 'mg' }],
  [ciqualHeaderKey('Chlorure'), { key: 'chloride', unit: 'mg' }],
  [ciqualHeaderKey('Copper'), { key: 'copper', unit: 'mg' }],
  [ciqualHeaderKey('Cuivre'), { key: 'copper', unit: 'mg' }],
  [ciqualHeaderKey('Iron'), { key: 'iron', unit: 'mg' }],
  [ciqualHeaderKey('Fer'), { key: 'iron', unit: 'mg' }],
  [ciqualHeaderKey('Iodine'), { key: 'iodine', unit: 'mcg' }],
  [ciqualHeaderKey('Iode'), { key: 'iodine', unit: 'mcg' }],
  [ciqualHeaderKey('Magnesium'), { key: 'magnesium', unit: 'mg' }],
  [ciqualHeaderKey('Manganese'), { key: 'manganese', unit: 'mg' }],
  [ciqualHeaderKey('Phosphorus'), { key: 'phosphorus', unit: 'mg' }],
  [ciqualHeaderKey('Phosphore'), { key: 'phosphorus', unit: 'mg' }],
  [ciqualHeaderKey('Potassium'), { key: 'potassium', unit: 'mg' }],
  [ciqualHeaderKey('Selenium'), { key: 'selenium', unit: 'mcg' }],
  [ciqualHeaderKey('Sodium'), { key: 'sodium', unit: 'mg' }],
  [ciqualHeaderKey('Zinc'), { key: 'zinc', unit: 'mg' }],
  // Vitamin A activity equivalents are the preferred total representation;
  // retinol and beta-carotene are subtypes and are not interchangeable.
  [
    ciqualHeaderKey('Vitamin A activity, retinol equivalent'),
    { key: 'vitaminA', unit: 'mcg' },
  ],
  [
    ciqualHeaderKey('Activite vitaminique A, equivalents retinol'),
    { key: 'vitaminA', unit: 'mcg' },
  ],
  [ciqualHeaderKey('Vitamin D'), { key: 'vitaminD', unit: 'mcg' }],
  [ciqualHeaderKey('Vitamine D'), { key: 'vitaminD', unit: 'mcg' }],
  [
    ciqualHeaderKey('Alpha-tocopherol (vitamine E)'),
    { key: 'vitaminE', unit: 'mg' },
  ],
  [
    ciqualHeaderKey('Alpha-tocopherol (vitamin E)'),
    { key: 'vitaminE', unit: 'mg' },
  ],
  [ciqualHeaderKey('Vitamin C'), { key: 'vitaminC', unit: 'mg' }],
  [ciqualHeaderKey('Vitamine C'), { key: 'vitaminC', unit: 'mg' }],
  [ciqualHeaderKey('Vitamin B1 or Thiamin'), { key: 'thiamine', unit: 'mg' }],
  [ciqualHeaderKey('Vitamine B1 ou Thiamine'), { key: 'thiamine', unit: 'mg' }],
  [
    ciqualHeaderKey('Vitamin B2 or Riboflavin'),
    { key: 'riboflavin', unit: 'mg' },
  ],
  [
    ciqualHeaderKey('Vitamine B2 ou Riboflavine'),
    { key: 'riboflavin', unit: 'mg' },
  ],
  [ciqualHeaderKey('Vitamin B3 or Niacin'), { key: 'niacin', unit: 'mg' }],
  [
    ciqualHeaderKey('Vitamine B3 ou PP ou Niacine'),
    { key: 'niacin', unit: 'mg' },
  ],
  [
    ciqualHeaderKey('Vitamin B5 or Pantothenic acid'),
    { key: 'pantothenicAcid', unit: 'mg' },
  ],
  [
    ciqualHeaderKey('Vitamine B5 ou Acide pantothenique'),
    { key: 'pantothenicAcid', unit: 'mg' },
  ],
  [ciqualHeaderKey('Vitamin B6'), { key: 'vitaminB6', unit: 'mg' }],
  [ciqualHeaderKey('Vitamine B6'), { key: 'vitaminB6', unit: 'mg' }],
  [ciqualHeaderKey('Vitamin B12'), { key: 'vitaminB12', unit: 'mcg' }],
  [ciqualHeaderKey('Vitamine B12'), { key: 'vitaminB12', unit: 'mcg' }],
  [
    ciqualHeaderKey('Vitamin B9 or total folates'),
    { key: 'folate', unit: 'mcg' },
  ],
  [
    ciqualHeaderKey('Vitamine B9 ou Folates totaux'),
    { key: 'folate', unit: 'mcg' },
  ],
]);

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

export function mapCiqualNutrient(
  label: string,
  value: unknown,
  sourceUnit: string,
): NormalizedProviderNutrient | null {
  const mapping = CIQUAL_MAPPINGS.get(ciqualHeaderKey(label));
  if (mapping === undefined) return null;
  return normalizeMappedNutrient(mapping, label, value, sourceUnit);
}

function normalizeMappedNutrient(
  mapping: Mapping,
  label: string,
  value: unknown,
  sourceUnit: string,
): NormalizedProviderNutrient | null {
  const amount = parseNullableNumber(value);
  if (amount === null) return null;
  const unit = normalizeIdentityText(sourceUnit)
    .replace(/^µg$/, 'mcg')
    .replace(/^μg$/, 'mcg')
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

export function mapProviderNutrient(
  label: string,
  value: unknown,
  sourceUnit: string,
): NormalizedProviderNutrient | null {
  const mapping = mappingForLabel(label);
  if (mapping === undefined) return null;
  return normalizeMappedNutrient(mapping, label, value, sourceUnit);
}
