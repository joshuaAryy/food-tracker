import { Prisma, type NutrientKey, type NutrientUnit } from '@prisma/client';
import {
  NUTRIENT_CATALOG,
  classifyServingUnit,
  foodItemServingOptionsSchema,
  type DefaultWholeItemServing,
  type FoodItemServingOptions,
  type NormalizedNutrientKey,
} from '@food-tracker/shared';
import { AppError } from '../../lib/errors.js';
import { roundTo } from '../../lib/serializers.js';
import {
  assessFoodCandidateAdequacy,
  scoreFoodCandidate,
} from './candidate-ranking.js';
import { foodIntentFallbackQuery } from './food-intent.js';

interface LimitBucket {
  windowStartedAt: number;
  windowCount: number;
}

const buckets = new Map<string, LimitBucket>();
const DEFAULT_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const USDA_SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const USDA_DETAIL_CACHE_TTL_MS = 18 * 60 * 60 * 1000;
const USDA_NOT_FOUND_CACHE_TTL_MS = 45 * 60 * 1000;
const USDA_TIMEOUT_CACHE_TTL_MS = 3 * 60 * 1000;
const USDA_METADATA_SEARCHES_PER_ENRICHMENT = 2;

export const USDA_ENRICHMENT_POLICIES = {
  normalSearch: {
    metadataLimit: 15,
    detailWindow: 6,
    concurrency: 3,
    detailTimeoutMs: 1200,
    totalBudgetMs: 2800,
  },
  aiRetrieval: {
    metadataLimit: 20,
    detailWindow: 8,
    concurrency: 3,
    detailTimeoutMs: 1500,
    totalBudgetMs: 4500,
  },
} as const;

export interface UsdaEnrichmentPolicy {
  metadataLimit: number;
  detailWindow: number;
  concurrency: number;
  detailTimeoutMs: number;
  totalBudgetMs: number;
}

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

export interface UsdaSearchFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner: string | null;
  brandName: string | null;
  foodCategory: string | null;
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
  servingOptions: Prisma.JsonValue | null;
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

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

type NegativeDetailReason = 'not_found' | 'timeout' | 'invalid';

const searchCache = new Map<string, CacheEntry<UsdaSearchFood[]>>();
const detailCache = new Map<string, CacheEntry<NormalizedUsdaFood>>();
const negativeDetailCache = new Map<string, CacheEntry<NegativeDetailReason>>();
const detailInflight = new Map<string, Promise<NormalizedUsdaFood | null>>();

export function clearUsdaFdcCaches(): void {
  buckets.clear();
  searchCache.clear();
  detailCache.clear();
  negativeDetailCache.clear();
  detailInflight.clear();
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
  return (await fetchJsonResult(url, init, timeoutMs)).payload;
}

async function fetchJsonResult(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{
  payload: unknown | null;
  failure: NegativeDetailReason | 'failure' | null;
}> {
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
      return {
        payload: null,
        failure: response.status === 404 ? 'not_found' : 'failure',
      };
    }

    return { payload: await response.json(), failure: null };
  } catch (error) {
    const isTimeout =
      error instanceof DOMException && error.name === 'AbortError';
    logUsdaDiagnostic(isTimeout ? 'timeout' : 'request_failure', {
      url: safeUrlForLog(url),
      message:
        error instanceof Error ? diagnosticText(error.message) : 'unknown',
    });
    return { payload: null, failure: isTimeout ? 'timeout' : 'failure' };
  } finally {
    clearTimeout(timeout);
  }
}

function cacheValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): T | null {
  const entry = cache.get(key);
  if (entry === undefined) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
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
    foodCategory: stringValue(value.foodCategory),
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
  metadataLimit?: number;
  timeoutMs?: number;
}): Promise<UsdaSearchFood[]> {
  const url = apiUrl(input.config, '/foods/search');
  if (url === null) return [];
  const internalSearchLimit =
    input.metadataLimit ?? Math.max(input.config.searchLimit * 3, 8);
  const normalizedQuery = normalizeText(input.query);
  const cacheKey = `${input.config.baseUrl}:${normalizedQuery}:${internalSearchLimit}`;
  const cached = cacheValue(searchCache, cacheKey);
  if (cached !== null) return cached;

  assertUsdaRateLimit({
    key: input.rateLimitKey,
    windowMs: input.config.rateLimitWindowMs,
    windowMax:
      input.config.rateLimitMax * USDA_METADATA_SEARCHES_PER_ENRICHMENT,
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
      }),
    },
    input.timeoutMs ?? input.config.timeoutMs,
  );

  if (!isRecord(payload)) return [];
  const response = payload as UsdaSearchResponse;
  const foods = Array.isArray(response.foods) ? response.foods : [];

  const result = foods
    .map(parseSearchFood)
    .filter((food): food is UsdaSearchFood => food !== null)
    .sort((a, b) => dataTypeRank(a.dataType) - dataTypeRank(b.dataType))
    .slice(0, internalSearchLimit);
  if (result.length > 0) {
    setCacheValue(searchCache, cacheKey, result, USDA_SEARCH_CACHE_TTL_MS);
  }
  return result;
}

export async function fetchUsdaFood(input: {
  sourceId: string;
  config: UsdaFdcConfig;
  timeoutMs?: number;
}): Promise<NormalizedUsdaFood | null> {
  const cached = cacheValue(detailCache, input.sourceId);
  if (cached !== null) return cached;
  if (cacheValue(negativeDetailCache, input.sourceId) !== null) return null;

  const url = apiUrl(
    input.config,
    `/food/${encodeURIComponent(input.sourceId)}`,
  );
  if (url === null) return null;
  const inflight = detailInflight.get(input.sourceId);
  if (inflight !== undefined) return inflight;

  const promise = (async () => {
    const fetched = await fetchJsonResult(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      input.timeoutMs ?? input.config.timeoutMs,
    );
    const food = normalizeUsdaFood(fetched.payload);
    if (food === null) {
      const reason =
        fetched.failure === 'not_found' || fetched.failure === 'timeout'
          ? fetched.failure
          : 'invalid';
      setCacheValue(
        negativeDetailCache,
        input.sourceId,
        reason,
        reason === 'timeout'
          ? USDA_TIMEOUT_CACHE_TTL_MS
          : USDA_NOT_FOUND_CACHE_TTL_MS,
      );
      return null;
    }
    setCacheValue(detailCache, input.sourceId, food, USDA_DETAIL_CACHE_TTL_MS);
    return food;
  })();
  detailInflight.set(input.sourceId, promise);

  try {
    return await promise;
  } finally {
    detailInflight.delete(input.sourceId);
  }
}

export function rankUsdaSearchFoods(
  query: string,
  foods: UsdaSearchFood[],
): UsdaSearchFood[] {
  return foods
    .map((food, index) => ({
      food,
      index,
      score: scoreUsdaSearchFood(query, food),
    }))
    .filter(({ score }) => score.relevant)
    .sort((left, right) => {
      if (right.score.score !== left.score.score) {
        return right.score.score - left.score.score;
      }
      const dataTypeDifference =
        dataTypeRank(left.food.dataType) - dataTypeRank(right.food.dataType);
      return dataTypeDifference === 0
        ? left.index - right.index
        : dataTypeDifference;
    })
    .map(({ food }) => food);
}

function scoreUsdaSearchFood(query: string, food: UsdaSearchFood) {
  return scoreFoodCandidate({
    query,
    candidate: {
      name: food.description,
      brandName: food.brandName ?? food.brandOwner,
      foodType:
        food.dataType === 'Branded' ||
        food.brandName !== null ||
        food.brandOwner !== null
          ? 'branded'
          : 'generic',
      source: 'usda_fdc',
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrientCount: 0,
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
    },
  });
}

function needsIntentQueryFallback(input: {
  query: string;
  foods: UsdaSearchFood[];
  detailWindow: number;
}): string | null {
  const adequacy = assessFoodCandidateAdequacy({
    query: input.query,
    candidateNames: input.foods.map((food) => food.description),
  });

  if (adequacy.adequateCandidateCount >= Math.min(2, input.detailWindow)) {
    return null;
  }

  const fallback = foodIntentFallbackQuery(input.query);
  return fallback === null ||
    normalizeText(fallback) === normalizeText(input.query)
    ? null
    : fallback;
}

export async function enrichUsdaFoods(input: {
  query: string;
  config: UsdaFdcConfig;
  rateLimitKey: string;
  policy: UsdaEnrichmentPolicy;
  isEnough?: (foods: NormalizedUsdaFood[]) => boolean;
}): Promise<NormalizedUsdaFood[]> {
  const deadline = Date.now() + input.policy.totalBudgetMs;
  const primaryMatches = await searchUsdaFoods({
    query: input.query,
    config: input.config,
    rateLimitKey: input.rateLimitKey,
    metadataLimit: input.policy.metadataLimit,
    timeoutMs: Math.max(1, deadline - Date.now()),
  });
  const fallbackQuery = needsIntentQueryFallback({
    query: input.query,
    foods: primaryMatches,
    detailWindow: input.policy.detailWindow,
  });
  const remainingFallbackBudget = deadline - Date.now();
  const fallbackMatches =
    fallbackQuery === null ||
    remainingFallbackBudget < input.policy.detailTimeoutMs
      ? []
      : await searchUsdaFoods({
          query: fallbackQuery,
          config: input.config,
          rateLimitKey: input.rateLimitKey,
          metadataLimit: input.policy.metadataLimit,
          timeoutMs: remainingFallbackBudget,
        });
  const matches = [...primaryMatches, ...fallbackMatches].filter(
    (food, index, foods) =>
      foods.findIndex((candidate) => candidate.fdcId === food.fdcId) === index,
  );
  const ranked = rankUsdaSearchFoods(input.query, matches);
  const initialWindow = ranked.slice(0, input.policy.detailWindow);
  const backfillWindow = ranked.slice(input.policy.detailWindow);
  const queue = [...initialWindow, ...backfillWindow];
  const result: NormalizedUsdaFood[] = [];

  for (let index = 0; index < queue.length; index += input.policy.concurrency) {
    if (Date.now() >= deadline) break;
    if (input.isEnough?.(result) ?? false) break;

    const batch = queue.slice(index, index + input.policy.concurrency);
    const remainingBudget = Math.max(1, deadline - Date.now());
    const timeoutMs = Math.min(input.policy.detailTimeoutMs, remainingBudget);
    const batchFoods = await Promise.all(
      batch.map((food) =>
        fetchUsdaFood({
          sourceId: String(food.fdcId),
          config: input.config,
          timeoutMs,
        }),
      ),
    );

    for (const food of batchFoods) {
      if (food !== null) result.push(food);
    }
  }

  return result;
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

function usdaServingOptions(
  payload: Record<string, unknown>,
  sourceId: string,
): Prisma.JsonValue | null {
  const portions = Array.isArray(payload.foodPortions)
    ? payload.foodPortions
    : [];
  const options = new Map<string, Prisma.JsonObject>();
  for (const portion of portions) {
    if (!isRecord(portion)) continue;
    const portionDescription = stringValue(portion.portionDescription);
    const describedQuantityMatch = portionDescription?.match(
      /^\s*(\d+(?:\.\d+)?)\s+/,
    );
    const describedQuantity =
      describedQuantityMatch === null || describedQuantityMatch === undefined
        ? null
        : Number(describedQuantityMatch[1]);
    const quantity = numericValue(portion.amount) ?? describedQuantity;
    const grams = numericValue(portion.gramWeight);
    const measureName = isRecord(portion.measureUnit)
      ? stringValue(portion.measureUnit.name)
      : null;
    const modifier = stringValue(portion.modifier);
    const normalizedMeasureName = measureName?.trim().toLocaleLowerCase();
    const foodName = stringValue(payload.description)?.split(',')[0]?.trim();
    const describedBody = portionDescription
      ?.replace(/^\s*\d+(?:\.\d+)?\s+/, '')
      .trim();
    const describedIdentity = describedBody?.match(
      /(?:^|\s)(egg|eggs|slice|slices|bar|bars|serving|servings|container|containers|item|items)(?:$|\s)/i,
    )?.[1];
    const describedUnit =
      describedIdentity === undefined
        ? null
        : describedIdentity.toLocaleLowerCase().startsWith('egg')
          ? 'egg'
          : describedIdentity.toLocaleLowerCase().startsWith('slice')
            ? 'slice'
            : describedIdentity.toLocaleLowerCase().startsWith('bar')
              ? 'bar'
              : describedIdentity.toLocaleLowerCase().startsWith('container')
                ? 'serving'
                : describedIdentity.toLocaleLowerCase().startsWith('item')
                  ? 'item'
                  : 'serving';
    const isDescribedMediumItem =
      foodName !== null && /^1\s+medium$/i.test(portionDescription ?? '');
    const isNamedMediumItem =
      normalizedMeasureName === 'medium' && modifier !== null;
    const measure =
      isDescribedMediumItem || isNamedMediumItem
        ? 'medium_item'
        : (describedUnit ??
          (normalizedMeasureName === 'container' ? 'serving' : measureName));
    const displayMeasure = isDescribedMediumItem
      ? `medium ${foodName}`
      : (describedBody ??
        (isNamedMediumItem ? `${measureName} ${modifier}` : measureName));
    const classified = measure === null ? null : classifyServingUnit(measure);
    if (
      quantity === null ||
      quantity <= 0 ||
      grams === null ||
      grams <= 0 ||
      classified === null
    )
      continue;
    if (classified.unit === 'g' && grams === 100) continue;
    const fingerprint = [classified.unit, quantity, grams].join(':');
    const option = {
      id: `provider:usda_fdc:${sourceId}:${fingerprint}`,
      label: `${quantity} ${displayMeasure}`,
      quantity,
      unit: classified.unit,
      unitFamily: classified.family,
      equivalentWeightGrams: grams,
      equivalentVolumeMl: null,
      source: 'provider',
      trust: 'trusted',
      provider: 'usda_fdc',
      providerDescription: `${quantity} ${displayMeasure}`,
    };
    if (
      foodItemServingOptionsSchema.safeParse({
        schemaVersion: 1,
        options: [option],
      }).success
    ) {
      options.set(fingerprint, option);
    }
  }
  if (options.size === 0) return null;
  const value = { schemaVersion: 1, options: [...options.values()] };
  return foodItemServingOptionsSchema.safeParse(value).success ? value : null;
}

export function defaultWholeItemServingFromOptions(
  options: FoodItemServingOptions | null,
): DefaultWholeItemServing | null {
  const eligible = (options?.options ?? []).filter(
    (option) =>
      (option.unit === 'item' ||
        option.unit === 'medium_item' ||
        option.unit === 'egg' ||
        option.unit === 'bar') &&
      (option.equivalentWeightGrams !== null ||
        option.equivalentVolumeMl !== null),
  );
  const generic = eligible.filter((option) => option.unit === 'item');
  const medium = eligible.filter((option) => option.unit === 'medium_item');
  const eggs = eligible.filter((option) => option.unit === 'egg');
  const bars = eligible.filter((option) => option.unit === 'bar');
  const preferred =
    generic.length === 1
      ? generic
      : generic.length > 1
        ? []
        : medium.length === 1
          ? medium
          : medium.length > 1
            ? []
            : eggs.length === 1
              ? eggs
              : eggs.length > 1
                ? []
                : bars.length === 1
                  ? bars
                  : [];
  const selected = preferred.length === 1 ? preferred[0] : null;
  return selected === null || selected === undefined
    ? null
    : {
        optionId: selected.id,
        label: selected.label,
        quantity: selected.quantity,
        unit: selected.unit,
        equivalentWeightGrams: selected.equivalentWeightGrams,
        equivalentVolumeMl: selected.equivalentVolumeMl,
      };
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
    servingOptions: usdaServingOptions(payload, String(Math.trunc(fdcId))),
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
    servingOptions:
      food.servingOptions === null ? Prisma.DbNull : food.servingOptions,
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
