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
  'vitamin b12': { key: 'vitaminB12', unit: 'mcg' },
  cholesterol: { key: 'cholesterol', unit: 'mg' },
  alcohol: { key: 'alcohol', unit: 'g' },
  water: { key: 'water', unit: 'g' },
};

export function mapProviderNutrient(
  label: string,
  value: unknown,
  sourceUnit: string,
): NormalizedProviderNutrient | null {
  const amount = parseNullableNumber(value);
  if (amount === null) return null;
  const mapping = MAPPINGS[normalizeIdentityText(label)];
  if (mapping === undefined) return null;
  const unit = normalizeIdentityText(sourceUnit);
  let normalizedAmount = amount;
  if (mapping.unit === 'mg' && unit === 'g') normalizedAmount *= 1000;
  if (mapping.unit === 'mcg' && unit === 'mg') normalizedAmount *= 1000;
  if (mapping.unit === 'g' && unit === 'mg') normalizedAmount /= 1000;
  return {
    key: mapping.key,
    amount: normalizedAmount,
    unit: mapping.unit,
    sourceLabel: label,
    sourceUnit,
    sourceValue: String(value),
  };
}
