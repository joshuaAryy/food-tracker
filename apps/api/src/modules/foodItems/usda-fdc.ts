import { Prisma, type NutrientKey, type NutrientUnit } from '@prisma/client';
import {
  NUTRIENT_CATALOG,
  type NormalizedNutrientKey,
} from '@food-tracker/shared';
import { AppError } from '../../lib/errors.js';
import { roundTo } from '../../lib/serializers.js';

interface LimitBucket {
  windowStartedAt: number;
  windowCount: number;
}

const buckets = new Map<string, LimitBucket>();
const DEFAULT_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

const USDA_DATA_TYPE_PRIORITY = [
  'Foundation',
  'SR Legacy',
  'Survey (FNDDS)',
  'Branded',
] as const;

const EXTENDED_NUTRIENT_ALIASES: Record<string, NormalizedNutrientKey> = {
  'fatty acids, total saturated': 'saturatedFat',
  'fatty acids, total trans': 'transFat',
  'fatty acids, total monounsaturated': 'monounsaturatedFat',
  'fatty acids, total polyunsaturated': 'polyunsaturatedFat',
  cholesterol: 'cholesterol',
  'potassium, k': 'potassium',
  'calcium, ca': 'calcium',
  'iron, fe': 'iron',
  'magnesium, mg': 'magnesium',
  'phosphorus, p': 'phosphorus',
  'zinc, zn': 'zinc',
  'copper, cu': 'copper',
  'manganese, mn': 'manganese',
  selenium: 'selenium',
  'vitamin c, total ascorbic acid': 'vitaminC',
  thiamin: 'thiamine',
  riboflavin: 'riboflavin',
  niacin: 'niacin',
  'pantothenic acid': 'pantothenicAcid',
  'vitamin b-6': 'vitaminB6',
  'folate, total': 'folate',
  'vitamin b-12': 'vitaminB12',
  'vitamin d (d2 + d3)': 'vitaminD',
  'vitamin e (alpha-tocopherol)': 'vitaminE',
  'vitamin k (phylloquinone)': 'vitaminK',
  caffeine: 'caffeine',
  alcohol: 'alcohol',
  water: 'water',
};

export interface UsdaFdcConfig {
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
  searchLimit: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

interface UsdaSearchResponse {
  foods?: unknown;
}

interface UsdaSearchFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner: string | null;
  brandName: string | null;
}

export interface NormalizedUsdaFood {
  name: string;
  brandName: string | null;
  sourceId: string;
  sourceUpdatedAt: Date | null;
  dataType: string;
  foodType: 'generic' | 'branded';
  servingBasisText: string;
  servingQuantity: number;
  servingUnit: string;
  servingWeightGrams: number;
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

function integerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function usdaFdcConfig(): UsdaFdcConfig {
  const apiKey = process.env.USDA_FDC_API_KEY?.trim();
  const baseUrl = process.env.USDA_FDC_BASE_URL?.trim().replace(/\/+$/, '');

  return {
    apiKey: apiKey === undefined || apiKey === '' ? null : apiKey,
    baseUrl:
      baseUrl === undefined || baseUrl === '' ? DEFAULT_BASE_URL : baseUrl,
    timeoutMs: integerEnv('USDA_FDC_TIMEOUT_MS', 5000),
    searchLimit: integerEnv('USDA_FDC_SEARCH_LIMIT', 3),
    rateLimitWindowMs: integerEnv('USDA_FDC_RATE_LIMIT_WINDOW', 600_000),
    rateLimitMax: integerEnv('USDA_FDC_RATE_LIMIT_MAX', 20),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateValue(value: unknown): Date | null {
  const text = stringValue(value);
  if (text === null) return null;

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeUrlForLog(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

function redactUrls(value: string): string {
  return value.replace(/https?:\/\/[^\s"',}]+/gi, (match) =>
    safeUrlForLog(match),
  );
}

function diagnosticText(value: string): string {
  return redactUrls(value)
    .replace(/api[_-]?key=([^&"'\s]+)/gi, 'api_key=[redacted]')
    .replace(
      /(api[_-]?key|key|token|authorization)["':=\s]+[^"',\s}]+/gi,
      '$1=[redacted]',
    )
    .slice(0, 800);
}

async function responseDiagnostic(response: Response): Promise<string> {
  try {
    return diagnosticText(await response.text());
  } catch {
    return '[unreadable response body]';
  }
}

function logUsdaDiagnostic(
  category: string,
  details: Record<string, unknown>,
): void {
  console.warn('[usda-fdc]', { category, ...details });
}

function assertUsdaRateLimit(input: {
  key: string;
  windowMs: number;
  windowMax: number;
  now?: Date;
}): void {
  const now = input.now ?? new Date();
  const currentTime = now.getTime();
  const bucket = buckets.get(input.key);
  const nextBucket: LimitBucket =
    bucket === undefined ||
    currentTime - bucket.windowStartedAt >= input.windowMs
      ? { windowStartedAt: currentTime, windowCount: 0 }
      : bucket;

  if (nextBucket.windowCount >= input.windowMax) {
    throw new AppError(
      429,
      'RATE_LIMITED',
      'Generic food lookup is temporarily limited. Try again later.',
    );
  }

  nextBucket.windowCount += 1;
  buckets.set(input.key, nextBucket);
}

function apiUrl(config: UsdaFdcConfig, path: string): string | null {
  if (config.apiKey === null) return null;

  const url = new URL(`${config.baseUrl}${path}`);
  url.searchParams.set('api_key', config.apiKey);
  return url.toString();
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      logUsdaDiagnostic('non_ok_response', {
        status: response.status,
        statusText: response.statusText,
        url: safeUrlForLog(url),
        body: await responseDiagnostic(response),
      });
      return null;
    }

    return await response.json();
  } catch (error) {
    logUsdaDiagnostic(
      error instanceof DOMException && error.name === 'AbortError'
        ? 'timeout'
        : 'request_failure',
      {
        url: safeUrlForLog(url),
        message:
          error instanceof Error ? diagnosticText(error.message) : 'unknown',
      },
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseSearchFood(value: unknown): UsdaSearchFood | null {
  if (!isRecord(value)) return null;
  const fdcId = numericValue(value.fdcId);
  const description = stringValue(value.description);
  const dataType = stringValue(value.dataType);

  if (fdcId === null || description === null || dataType === null) {
    return null;
  }

  return {
    fdcId,
    description,
    dataType,
    brandOwner: stringValue(value.brandOwner),
    brandName: stringValue(value.brandName),
  };
}

function dataTypeRank(value: string): number {
  const index = USDA_DATA_TYPE_PRIORITY.findIndex(
    (dataType) => dataType === value,
  );
  return index === -1 ? USDA_DATA_TYPE_PRIORITY.length : index;
}

export async function searchUsdaFoods(input: {
  query: string;
  config: UsdaFdcConfig;
  rateLimitKey: string;
}): Promise<UsdaSearchFood[]> {
  const url = apiUrl(input.config, '/foods/search');
  if (url === null) return [];
  const internalSearchLimit = Math.max(input.config.searchLimit * 3, 8);

  assertUsdaRateLimit({
    key: input.rateLimitKey,
    windowMs: input.config.rateLimitWindowMs,
    windowMax: input.config.rateLimitMax,
  });

  const payload = await fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: input.query,
        pageSize: internalSearchLimit,
        dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'],
        sortBy: 'dataType.keyword',
        sortOrder: 'asc',
      }),
    },
    input.config.timeoutMs,
  );

  if (!isRecord(payload)) return [];
  const response = payload as UsdaSearchResponse;
  const foods = Array.isArray(response.foods) ? response.foods : [];

  return foods
    .map(parseSearchFood)
    .filter((food): food is UsdaSearchFood => food !== null)
    .sort((a, b) => dataTypeRank(a.dataType) - dataTypeRank(b.dataType))
    .slice(0, internalSearchLimit);
}

export async function fetchUsdaFood(input: {
  sourceId: string;
  config: UsdaFdcConfig;
}): Promise<NormalizedUsdaFood | null> {
  const url = apiUrl(
    input.config,
    `/food/${encodeURIComponent(input.sourceId)}`,
  );
  if (url === null) return null;

  const payload = await fetchJson(
    url,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    input.config.timeoutMs,
  );

  return normalizeUsdaFood(payload);
}

function nutrientEntries(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  return Array.isArray(payload.foodNutrients)
    ? payload.foodNutrients.filter(isRecord)
    : [];
}

function nutrientName(entry: Record<string, unknown>): string | null {
  if (isRecord(entry.nutrient)) {
    return stringValue(entry.nutrient.name)?.toLocaleLowerCase() ?? null;
  }

  return stringValue(entry.nutrientName)?.toLocaleLowerCase() ?? null;
}

function nutrientUnit(entry: Record<string, unknown>): string | null {
  if (isRecord(entry.nutrient)) {
    return stringValue(entry.nutrient.unitName)?.toLocaleLowerCase() ?? null;
  }

  return stringValue(entry.unitName)?.toLocaleLowerCase() ?? null;
}

function nutrientAmount(entry: Record<string, unknown>): number | null {
  return numericValue(entry.amount) ?? numericValue(entry.value);
}

function amountFor(
  entries: Record<string, unknown>[],
  aliases: string[],
  unit: string,
): number | null {
  for (const entry of entries) {
    const name = nutrientName(entry);
    if (name === null || !aliases.includes(name)) continue;
    if (nutrientUnit(entry) !== unit) continue;
    const amount = nutrientAmount(entry);
    if (amount !== null) return amount;
  }

  return null;
}

function decimalColumn(
  entries: Record<string, unknown>[],
  aliases: string[],
): number | null {
  const amount = amountFor(entries, aliases, 'g');
  return amount === null ? null : roundTo(amount, 1);
}

function sodiumColumn(entries: Record<string, unknown>[]): number | null {
  const amount = amountFor(entries, ['sodium, na'], 'mg');
  return amount === null ? null : Math.round(amount);
}

function mappedNutrient(entry: Record<string, unknown>): {
  nutrientKey: NutrientKey;
  amount: number;
  unit: NutrientUnit;
} | null {
  const name = nutrientName(entry);
  if (name === null) return null;
  const nutrientKey = EXTENDED_NUTRIENT_ALIASES[name];
  if (nutrientKey === undefined) return null;

  const catalogUnit = NUTRIENT_CATALOG[nutrientKey].defaultUnit;
  const sourceUnit = nutrientUnit(entry);
  const amount = nutrientAmount(entry);
  if (sourceUnit === null || amount === null) return null;

  if (sourceUnit === catalogUnit) {
    return { nutrientKey, amount: roundTo(amount, 4), unit: catalogUnit };
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

export function normalizeUsdaFood(payload: unknown): NormalizedUsdaFood | null {
  if (!isRecord(payload)) return null;

  const fdcId = numericValue(payload.fdcId);
  const name = stringValue(payload.description);
  const dataType = stringValue(payload.dataType);
  if (fdcId === null || name === null || dataType === null) return null;

  const entries = nutrientEntries(payload);
  const calories = amountFor(entries, ['energy'], 'kcal');
  const nutrients = entries.map(mappedNutrient).filter(
    (
      nutrient,
    ): nutrient is {
      nutrientKey: NutrientKey;
      amount: number;
      unit: NutrientUnit;
    } => nutrient !== null,
  );
  const sourceUpdatedAt = dateValue(payload.publicationDate);

  return {
    name,
    brandName:
      stringValue(payload.brandOwner) ?? stringValue(payload.brandName),
    sourceId: String(Math.trunc(fdcId)),
    sourceUpdatedAt,
    dataType,
    foodType: dataType === 'Branded' ? 'branded' : 'generic',
    servingBasisText: 'per 100 g',
    servingQuantity: 100,
    servingUnit: 'g',
    servingWeightGrams: 100,
    calories: calories === null ? null : Math.round(calories),
    protein: decimalColumn(entries, ['protein']),
    carbs: decimalColumn(entries, ['carbohydrate, by difference']),
    fat: decimalColumn(entries, ['total lipid (fat)', 'total fat (nlea)']),
    fiber: decimalColumn(entries, ['fiber, total dietary']),
    sugar: decimalColumn(entries, [
      'total sugars',
      'sugars, total including nlea',
    ]),
    sodium: sodiumColumn(entries),
    nutrients,
  };
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function usdaFoodItemData(
  food: NormalizedUsdaFood,
): Prisma.FoodItemCreateInput {
  const normalizedName = normalizeText(food.name);
  const normalizedBrandName =
    food.brandName === null ? null : normalizeText(food.brandName);

  return {
    name: food.name,
    brandName: food.brandName,
    sourceType: 'cached_external',
    foodType: food.foodType,
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
    sourceProvider: 'usda_fdc',
    sourceId: food.sourceId,
    sourceUpdatedAt: food.sourceUpdatedAt,
    nutrients: { create: food.nutrients },
  };
}

export async function findOrCreateUsdaFoodItem(input: {
  sourceId: string;
  config: UsdaFdcConfig;
  transaction: Prisma.TransactionClient;
}) {
  const existing = await input.transaction.foodItem.findFirst({
    where: {
      userId: null,
      archivedAt: null,
      sourceType: 'cached_external',
      sourceProvider: 'usda_fdc',
      sourceId: input.sourceId,
    },
    include: { nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] } },
  });

  if (existing !== null) return existing;

  const food = await fetchUsdaFood({
    sourceId: input.sourceId,
    config: input.config,
  });
  if (food === null || food.calories === null || food.protein === null) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'USDA food needs calories and protein before it can be logged.',
      {
        issues: [
          {
            path: ['items'],
            message:
              'USDA food needs calories and protein before it can be logged.',
          },
        ],
      },
    );
  }

  const created = await input.transaction.foodItem.create({
    data: usdaFoodItemData(food),
  });

  return input.transaction.foodItem.findUniqueOrThrow({
    where: { id: created.id },
    include: { nutrients: { orderBy: [{ nutrientKey: 'asc' as const }] } },
  });
}
