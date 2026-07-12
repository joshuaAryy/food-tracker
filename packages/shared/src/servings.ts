import type { NormalizedNutrientMap } from './types.js';

export const MAX_SERVING_QUANTITY = 10_000;

export const SERVING_UNIT_FAMILIES = [
  'mass',
  'volume',
  'count',
  'household',
] as const;

export const SERVING_UNITS = [
  'g',
  'kg',
  'mg',
  'oz',
  'lb',
  'ml',
  'l',
  'metric_tsp',
  'metric_tbsp',
  'metric_cup',
  'us_tsp',
  'us_tbsp',
  'us_cup',
  'us_fl_oz',
  'imperial_fl_oz',
  'tsp',
  'tbsp',
  'cup',
  'fl_oz',
  'item',
  'serving',
  'egg',
  'slice',
  'bar',
  'bowl',
  'plate',
  'handful',
  'medium_item',
] as const;

export type ServingUnitFamily = (typeof SERVING_UNIT_FAMILIES)[number];
export type ServingUnit = (typeof SERVING_UNITS)[number];

export interface ServingUnitClassification {
  unit: ServingUnit;
  family: ServingUnitFamily;
}

export type ServingQuantityErrorCode =
  | 'NOT_A_NUMBER'
  | 'NOT_FINITE'
  | 'ZERO_OR_NEGATIVE'
  | 'ABOVE_MAXIMUM';

export interface ServingScalingError {
  code: ServingQuantityErrorCode | 'INCOMPATIBLE_UNITS';
  message: string;
}

export type ServingQuantityValidationResult =
  | { success: true; quantity: number }
  | { success: false; error: ServingScalingError };

export type ServingMultiplierCalculationResult =
  | { success: true; multiplier: number }
  | { success: false; error: ServingScalingError };

export interface ServingMultiplierInput {
  requestedQuantity: unknown;
  basisQuantity: unknown;
  directlyCompatible: boolean;
}

export interface ScalableNutrition {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  nutrients: NormalizedNutrientMap;
}

const servingUnitAliases: Readonly<Record<string, ServingUnitClassification>> =
  {
    g: { unit: 'g', family: 'mass' },
    gram: { unit: 'g', family: 'mass' },
    grams: { unit: 'g', family: 'mass' },
    kg: { unit: 'kg', family: 'mass' },
    kilogram: { unit: 'kg', family: 'mass' },
    kilograms: { unit: 'kg', family: 'mass' },
    mg: { unit: 'mg', family: 'mass' },
    milligram: { unit: 'mg', family: 'mass' },
    milligrams: { unit: 'mg', family: 'mass' },
    oz: { unit: 'oz', family: 'mass' },
    ounce: { unit: 'oz', family: 'mass' },
    ounces: { unit: 'oz', family: 'mass' },
    lb: { unit: 'lb', family: 'mass' },
    lbs: { unit: 'lb', family: 'mass' },
    pound: { unit: 'lb', family: 'mass' },
    pounds: { unit: 'lb', family: 'mass' },
    ml: { unit: 'ml', family: 'volume' },
    milliliter: { unit: 'ml', family: 'volume' },
    milliliters: { unit: 'ml', family: 'volume' },
    millilitre: { unit: 'ml', family: 'volume' },
    millilitres: { unit: 'ml', family: 'volume' },
    l: { unit: 'l', family: 'volume' },
    liter: { unit: 'l', family: 'volume' },
    liters: { unit: 'l', family: 'volume' },
    litre: { unit: 'l', family: 'volume' },
    litres: { unit: 'l', family: 'volume' },
    metric_tsp: { unit: 'metric_tsp', family: 'volume' },
    'metric tsp': { unit: 'metric_tsp', family: 'volume' },
    'metric teaspoon': { unit: 'metric_tsp', family: 'volume' },
    metric_tbsp: { unit: 'metric_tbsp', family: 'volume' },
    'metric tbsp': { unit: 'metric_tbsp', family: 'volume' },
    'metric tablespoon': { unit: 'metric_tbsp', family: 'volume' },
    metric_cup: { unit: 'metric_cup', family: 'volume' },
    'metric cup': { unit: 'metric_cup', family: 'volume' },
    us_tsp: { unit: 'us_tsp', family: 'volume' },
    'us tsp': { unit: 'us_tsp', family: 'volume' },
    'us teaspoon': { unit: 'us_tsp', family: 'volume' },
    us_tbsp: { unit: 'us_tbsp', family: 'volume' },
    'us tbsp': { unit: 'us_tbsp', family: 'volume' },
    'us tablespoon': { unit: 'us_tbsp', family: 'volume' },
    us_cup: { unit: 'us_cup', family: 'volume' },
    'us cup': { unit: 'us_cup', family: 'volume' },
    us_fl_oz: { unit: 'us_fl_oz', family: 'volume' },
    'us fl oz': { unit: 'us_fl_oz', family: 'volume' },
    'us fluid ounce': { unit: 'us_fl_oz', family: 'volume' },
    imperial_fl_oz: { unit: 'imperial_fl_oz', family: 'volume' },
    'imperial fl oz': { unit: 'imperial_fl_oz', family: 'volume' },
    'imperial fluid ounce': { unit: 'imperial_fl_oz', family: 'volume' },
    tsp: { unit: 'tsp', family: 'household' },
    teaspoon: { unit: 'tsp', family: 'household' },
    teaspoons: { unit: 'tsp', family: 'household' },
    tbsp: { unit: 'tbsp', family: 'household' },
    tablespoon: { unit: 'tbsp', family: 'household' },
    tablespoons: { unit: 'tbsp', family: 'household' },
    cup: { unit: 'cup', family: 'household' },
    cups: { unit: 'cup', family: 'household' },
    fl_oz: { unit: 'fl_oz', family: 'household' },
    'fl oz': { unit: 'fl_oz', family: 'household' },
    'fluid ounce': { unit: 'fl_oz', family: 'household' },
    'fluid ounces': { unit: 'fl_oz', family: 'household' },
    item: { unit: 'item', family: 'count' },
    items: { unit: 'item', family: 'count' },
    serving: { unit: 'serving', family: 'count' },
    servings: { unit: 'serving', family: 'count' },
    egg: { unit: 'egg', family: 'count' },
    eggs: { unit: 'egg', family: 'count' },
    slice: { unit: 'slice', family: 'count' },
    slices: { unit: 'slice', family: 'count' },
    bar: { unit: 'bar', family: 'count' },
    bars: { unit: 'bar', family: 'count' },
    bowl: { unit: 'bowl', family: 'household' },
    bowls: { unit: 'bowl', family: 'household' },
    plate: { unit: 'plate', family: 'household' },
    plates: { unit: 'plate', family: 'household' },
    handful: { unit: 'handful', family: 'household' },
    handfuls: { unit: 'handful', family: 'household' },
    'medium item': { unit: 'medium_item', family: 'household' },
    'medium items': { unit: 'medium_item', family: 'household' },
    medium_item: { unit: 'medium_item', family: 'household' },
  };

function normalizedUnitText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
}

function quantityError(
  code: ServingQuantityErrorCode,
  message: string,
): ServingQuantityValidationResult {
  return { success: false, error: { code, message } };
}

function scaleOptional(
  value: number | null,
  multiplier: number,
): number | null {
  return value === null ? null : value * multiplier;
}

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function validateServingQuantity(
  value: unknown,
): ServingQuantityValidationResult {
  if (typeof value !== 'number') {
    return quantityError('NOT_A_NUMBER', 'Serving quantity must be a number.');
  }

  if (!Number.isFinite(value)) {
    return quantityError('NOT_FINITE', 'Serving quantity must be finite.');
  }

  if (value <= 0) {
    return quantityError(
      'ZERO_OR_NEGATIVE',
      'Serving quantity must be greater than zero.',
    );
  }

  if (value > MAX_SERVING_QUANTITY) {
    return quantityError(
      'ABOVE_MAXIMUM',
      `Serving quantity must be ${MAX_SERVING_QUANTITY} or less.`,
    );
  }

  return { success: true, quantity: value };
}

export function classifyServingUnit(
  value: string,
): ServingUnitClassification | null {
  return servingUnitAliases[normalizedUnitText(value)] ?? null;
}

const standardMassGrams: Readonly<Record<'g' | 'kg' | 'oz' | 'lb', number>> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

const standardVolumeMillilitres: Readonly<Record<'ml' | 'l', number>> = {
  ml: 1,
  l: 1000,
};

/** Converts only region-neutral standard units within one physical family. */
export function convertCompatibleServingQuantity(input: {
  quantity: number;
  fromUnit: string;
  toUnit: string;
}): number | null {
  const from = classifyServingUnit(input.fromUnit);
  const to = classifyServingUnit(input.toUnit);
  if (from === null || to === null || from.family !== to.family) return null;

  if (from.family === 'mass' && to.family === 'mass') {
    const fromFactor =
      standardMassGrams[from.unit as keyof typeof standardMassGrams];
    const toFactor =
      standardMassGrams[to.unit as keyof typeof standardMassGrams];
    if (fromFactor === undefined || toFactor === undefined) return null;
    return (input.quantity * fromFactor) / toFactor;
  }
  if (from.family === 'volume' && to.family === 'volume') {
    const fromFactor =
      standardVolumeMillilitres[
        from.unit as keyof typeof standardVolumeMillilitres
      ];
    const toFactor =
      standardVolumeMillilitres[
        to.unit as keyof typeof standardVolumeMillilitres
      ];
    if (fromFactor === undefined || toFactor === undefined) return null;
    return (input.quantity * fromFactor) / toFactor;
  }
  return null;
}

export function areServingUnitsDirectlyCompatible(
  requestedUnit: string,
  basisUnit: string,
): boolean {
  const requested = classifyServingUnit(requestedUnit);
  const basis = classifyServingUnit(basisUnit);

  return requested !== null && basis !== null && requested.unit === basis.unit;
}

export function calculateServingMultiplier(
  input: ServingMultiplierInput,
): ServingMultiplierCalculationResult {
  if (!input.directlyCompatible) {
    return {
      success: false,
      error: {
        code: 'INCOMPATIBLE_UNITS',
        message: 'Serving units must be directly compatible.',
      },
    };
  }

  const requested = validateServingQuantity(input.requestedQuantity);
  if (!requested.success) return requested;

  const basis = validateServingQuantity(input.basisQuantity);
  if (!basis.success) return basis;

  const multiplier = requested.quantity / basis.quantity;
  if (!Number.isFinite(multiplier)) {
    return {
      success: false,
      error: {
        code: 'NOT_FINITE',
        message: 'Serving multiplier must be finite.',
      },
    };
  }

  return { success: true, multiplier };
}

export function scaleNutritionAtFullPrecision(
  nutrition: ScalableNutrition,
  multiplier: number,
): ScalableNutrition {
  return {
    calories: scaleOptional(nutrition.calories, multiplier),
    protein: scaleOptional(nutrition.protein, multiplier),
    carbs: scaleOptional(nutrition.carbs, multiplier),
    fat: scaleOptional(nutrition.fat, multiplier),
    fiber: scaleOptional(nutrition.fiber, multiplier),
    sugar: scaleOptional(nutrition.sugar, multiplier),
    sodium: scaleOptional(nutrition.sodium, multiplier),
    nutrients: Object.fromEntries(
      Object.entries(nutrition.nutrients).map(([nutrientKey, nutrient]) => [
        nutrientKey,
        { amount: nutrient.amount * multiplier, unit: nutrient.unit },
      ]),
    ) as NormalizedNutrientMap,
  };
}

export function roundServingNutritionForStorage(
  nutrition: ScalableNutrition,
): ScalableNutrition {
  return {
    calories:
      nutrition.calories === null ? null : Math.round(nutrition.calories),
    protein: nutrition.protein === null ? null : roundTo(nutrition.protein, 1),
    carbs: nutrition.carbs === null ? null : roundTo(nutrition.carbs, 1),
    fat: nutrition.fat === null ? null : roundTo(nutrition.fat, 1),
    fiber: nutrition.fiber === null ? null : roundTo(nutrition.fiber, 1),
    sugar: nutrition.sugar === null ? null : roundTo(nutrition.sugar, 1),
    sodium: nutrition.sodium === null ? null : Math.round(nutrition.sodium),
    nutrients: Object.fromEntries(
      Object.entries(nutrition.nutrients).map(([nutrientKey, nutrient]) => [
        nutrientKey,
        { amount: roundTo(nutrient.amount, 4), unit: nutrient.unit },
      ]),
    ) as NormalizedNutrientMap,
  };
}

export function roundServingWeightForDisplay(value: number): number {
  return roundTo(value, 1);
}
