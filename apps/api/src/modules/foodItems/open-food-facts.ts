import { Prisma, type NutrientKey, type NutrientUnit } from '@prisma/client';
import {
  NUTRIENT_CATALOG,
  type NormalizedNutrientKey,
} from '@food-tracker/shared';
import { roundTo } from '../../lib/serializers.js';

const OPEN_FOOD_FACTS_PRODUCT_URL =
  'https://world.openfoodfacts.org/api/v3/product';

interface OpenFoodFactsProductResponse {
  status?: unknown;
  result?: { id?: unknown };
  product?: unknown;
}

export interface NormalizedOpenFoodFactsFood {
  name: string;
  brandName: string | null;
  sourceId: string;
  sourceUpdatedAt: Date | null;
  servingQuantity: number | null;
  servingUnit: string | null;
  servingWeightGrams: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  nutrients: {
    nutrientKey: NutrientKey;
    amount: number;
    unit: NutrientUnit;
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function unitValue(value: unknown): string | null {
  const unit = stringValue(value);
  return unit === null ? null : unit.toLocaleLowerCase();
}

function parseQuantity(
  value: unknown,
): { amount: number; unit: string } | null {
  const text = stringValue(value);
  if (text === null) {
    return null;
  }

  const match = text.match(
    /(\d+(?:[.,]\d+)?)\s*(g|gram|grams|ml|milliliter|milliliters|oz|fl oz|serving|servings)\b/i,
  );
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }

  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const rawUnit = match[2].toLocaleLowerCase();
  const unit =
    rawUnit === 'gram' || rawUnit === 'grams'
      ? 'g'
      : rawUnit === 'milliliter' || rawUnit === 'milliliters'
        ? 'ml'
        : rawUnit;

  return { amount: roundTo(amount, 2), unit };
}

function parseServing(product: Record<string, unknown>): {
  servingQuantity: number | null;
  servingUnit: string | null;
  servingWeightGrams: number | null;
} {
  const nutritionDataPer = stringValue(product.nutrition_data_per);
  const serving =
    nutritionDataPer === 'serving'
      ? (parseQuantity(product.serving_size) ??
        parseQuantity(product.serving_quantity))
      : null;

  if (serving !== null) {
    return {
      servingQuantity: serving.amount,
      servingUnit: serving.unit,
      servingWeightGrams: serving.unit === 'g' ? serving.amount : null,
    };
  }

  if (nutritionDataPer === '100g' || nutritionDataPer === null) {
    return {
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
    };
  }

  const quantityUnit = stringValue(product.product_quantity_unit);
  const productQuantity = numericValue(product.product_quantity);
  if (
    productQuantity !== null &&
    productQuantity > 0 &&
    quantityUnit !== null &&
    ['g', 'ml'].includes(quantityUnit.toLocaleLowerCase())
  ) {
    return {
      servingQuantity: roundTo(productQuantity, 2),
      servingUnit: quantityUnit.toLocaleLowerCase(),
      servingWeightGrams:
        quantityUnit.toLocaleLowerCase() === 'g'
          ? roundTo(productQuantity, 2)
          : null,
    };
  }

  return {
    servingQuantity: null,
    servingUnit: null,
    servingWeightGrams: null,
  };
}

function nutrientAmount(
  nutriments: Record<string, unknown>,
  key: string,
  suffix: 'serving' | '100g',
): number | null {
  return (
    numericValue(nutriments[`${key}_${suffix}`]) ??
    numericValue(nutriments[key])
  );
}

function nutrientUnit(
  nutriments: Record<string, unknown>,
  key: string,
): string | null {
  return unitValue(nutriments[`${key}_unit`]);
}

function gramValue(
  nutriments: Record<string, unknown>,
  key: string,
  suffix: 'serving' | '100g',
): number | null {
  const amount = nutrientAmount(nutriments, key, suffix);
  if (amount === null) {
    return null;
  }

  const unit = nutrientUnit(nutriments, key);
  if (unit !== null && unit !== 'g') {
    return null;
  }

  return roundTo(amount, 1);
}

function sodiumMg(
  nutriments: Record<string, unknown>,
  suffix: 'serving' | '100g',
): number | null {
  const amount = nutrientAmount(nutriments, 'sodium', suffix);
  if (amount === null) {
    return null;
  }

  const unit = nutrientUnit(nutriments, 'sodium') ?? 'g';
  if (unit === 'mg') {
    return Math.round(amount);
  }
  if (unit === 'g') {
    return Math.round(amount * 1000);
  }

  return null;
}

function mappedNutrient(
  nutriments: Record<string, unknown>,
  sourceKey: string,
  nutrientKey: NormalizedNutrientKey,
  suffix: 'serving' | '100g',
): {
  nutrientKey: NutrientKey;
  amount: number;
  unit: NutrientUnit;
} | null {
  const amount = nutrientAmount(nutriments, sourceKey, suffix);
  if (amount === null) {
    return null;
  }

  const catalogUnit = NUTRIENT_CATALOG[nutrientKey].defaultUnit;
  const sourceUnit = nutrientUnit(nutriments, sourceKey);
  if (sourceUnit === catalogUnit) {
    return {
      nutrientKey,
      amount: roundTo(amount, 4),
      unit: catalogUnit,
    };
  }

  if (sourceUnit === 'g' && catalogUnit === 'mg') {
    return {
      nutrientKey,
      amount: roundTo(amount * 1000, 4),
      unit: catalogUnit,
    };
  }

  if (sourceUnit === 'mg' && catalogUnit === 'mcg') {
    return {
      nutrientKey,
      amount: roundTo(amount * 1000, 4),
      unit: catalogUnit,
    };
  }

  return null;
}

export function normalizeOpenFoodFactsProduct(
  barcode: string,
  payload: unknown,
): NormalizedOpenFoodFactsFood | null {
  if (!isRecord(payload)) {
    return null;
  }

  const response = payload as OpenFoodFactsProductResponse;
  if (response.status !== 'success' || !isRecord(response.product)) {
    return null;
  }

  const product = response.product;
  const name = stringValue(product.product_name);
  if (name === null) {
    return null;
  }

  const sourceId = stringValue(product.code) ?? barcode;
  const nutriments = isRecord(product.nutriments) ? product.nutriments : {};
  const nutritionDataPer = stringValue(product.nutrition_data_per);
  const suffix = nutritionDataPer === 'serving' ? 'serving' : '100g';
  const sourceUpdatedAt = numericValue(product.last_modified_t);

  const nutrients = [
    mappedNutrient(nutriments, 'saturated-fat', 'saturatedFat', suffix),
    mappedNutrient(nutriments, 'trans-fat', 'transFat', suffix),
    mappedNutrient(nutriments, 'cholesterol', 'cholesterol', suffix),
    mappedNutrient(nutriments, 'potassium', 'potassium', suffix),
    mappedNutrient(nutriments, 'calcium', 'calcium', suffix),
    mappedNutrient(nutriments, 'iron', 'iron', suffix),
    mappedNutrient(nutriments, 'vitamin-c', 'vitaminC', suffix),
    mappedNutrient(nutriments, 'vitamin-d', 'vitaminD', suffix),
  ].filter(
    (
      nutrient,
    ): nutrient is {
      nutrientKey: NutrientKey;
      amount: number;
      unit: NutrientUnit;
    } => nutrient !== null,
  );

  return {
    name,
    brandName: stringValue(product.brands),
    sourceId,
    sourceUpdatedAt:
      sourceUpdatedAt === null ? null : new Date(sourceUpdatedAt * 1000),
    ...parseServing(product),
    calories:
      nutrientAmount(nutriments, 'energy-kcal', suffix) === null
        ? null
        : Math.round(nutrientAmount(nutriments, 'energy-kcal', suffix) ?? 0),
    protein: gramValue(nutriments, 'proteins', suffix),
    carbs: gramValue(nutriments, 'carbohydrates', suffix),
    fat: gramValue(nutriments, 'fat', suffix),
    fiber: gramValue(nutriments, 'fiber', suffix),
    sugar: gramValue(nutriments, 'sugars', suffix),
    sodium: sodiumMg(nutriments, suffix),
    nutrients,
  };
}

export async function fetchOpenFoodFactsProduct(
  barcode: string,
): Promise<NormalizedOpenFoodFactsFood | null> {
  const fields = [
    'code',
    'product_name',
    'brands',
    'quantity',
    'serving_size',
    'serving_quantity',
    'product_quantity',
    'product_quantity_unit',
    'nutrition_data_per',
    'nutriments',
    'last_modified_t',
  ].join(',');
  const response = await fetch(
    `${OPEN_FOOD_FACTS_PRODUCT_URL}/${encodeURIComponent(
      barcode,
    )}.json?fields=${encodeURIComponent(fields)}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'FoodTracker/0.1 (https://github.com/food-tracker; contact: local-dev)',
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  return normalizeOpenFoodFactsProduct(barcode, await response.json());
}

export function openFoodFactsData(
  food: NormalizedOpenFoodFactsFood,
): Prisma.FoodItemCreateInput {
  const normalizedName = food.name
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');
  const normalizedBrandName =
    food.brandName === null
      ? null
      : food.brandName.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

  return {
    name: food.name,
    brandName: food.brandName,
    sourceType: 'cached_external',
    foodType: 'branded',
    normalizedName,
    normalizedBrandName,
    searchText:
      normalizedBrandName === null
        ? normalizedName
        : `${normalizedName} ${normalizedBrandName}`,
    servingQuantity: food.servingQuantity,
    servingUnit: food.servingUnit,
    servingWeightGrams: food.servingWeightGrams,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    sugar: food.sugar,
    sodium: food.sodium,
    additionalNutrients: Prisma.JsonNull,
    sourceProvider: 'open_food_facts',
    sourceId: food.sourceId,
    sourceUpdatedAt: food.sourceUpdatedAt,
    nutrients: {
      create: food.nutrients,
    },
  };
}
