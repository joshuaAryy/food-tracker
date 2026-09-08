import { MOCK_USER_ID } from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { persistProviderFoods } from '../src/modules/foodItems/providers/importer.js';
import type { NormalizedProviderFood } from '../src/modules/foodItems/providers/normalized.js';

const loggedAt = '2026-06-15T17:00:00.000Z';

type FoodOverrides = {
  servingQuantity?: number;
  servingUnit?: string;
  servingWeightGrams?: number | null;
  servingOptions?: Prisma.InputJsonValue | null;
  calories?: number;
  protein?: number;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
  nutrients?: Array<{
    nutrientKey: 'potassium' | 'vitaminC';
    amount: number;
    unit: 'mg';
  }>;
};

async function trustedFood(overrides: FoodOverrides = {}) {
  return prisma.foodItem.create({
    data: {
      userId: MOCK_USER_ID,
      name: 'Authoritative food',
      normalizedName: 'authoritative food',
      searchText: 'authoritative food',
      sourceType: 'cached_external',
      sourceProvider: 'usda_fdc',
      sourceId: '12345',
      foodType: 'generic',
      servingQuantity: overrides.servingQuantity ?? 100,
      servingUnit: overrides.servingUnit ?? 'g',
      servingWeightGrams:
        overrides.servingWeightGrams === undefined
          ? 100
          : overrides.servingWeightGrams,
      servingOptions:
        overrides.servingOptions === undefined
          ? Prisma.JsonNull
          : overrides.servingOptions === null
            ? Prisma.JsonNull
            : overrides.servingOptions,
      calories: overrides.calories ?? 101,
      protein: overrides.protein ?? 10.1,
      carbs: overrides.carbs ?? 5.5,
      fat: overrides.fat ?? 2.2,
      fiber: overrides.fiber ?? null,
      sugar: overrides.sugar ?? null,
      sodium: overrides.sodium ?? 50,
      nutrients: {
        create: overrides.nutrients ?? [
          { nutrientKey: 'potassium', amount: 120.1234, unit: 'mg' },
          { nutrientKey: 'vitaminC', amount: 12.3456, unit: 'mg' },
        ],
      },
    },
  });
}

function request(foodItemId: string, extra: Record<string, unknown> = {}) {
  return api.post('/api/v1/food-logs/from-food-item').send({
    foodItemId,
    mealType: 'breakfast',
    loggedAt,
    ...extra,
  });
}

function trustedOption(
  id: string,
  unit: 'egg' | 'slice' | 'cup',
  grams: number,
) {
  return {
    id,
    label: `1 ${unit}`,
    quantity: 1,
    unit,
    unitFamily: unit === 'cup' ? 'household' : 'count',
    equivalentWeightGrams: grams,
    equivalentVolumeMl: null,
    source: 'provider',
    trust: 'trusted',
    provider: 'usda_fdc',
    providerDescription: `1 ${unit} = ${grams} g`,
  };
}

async function expectNoWrites() {
  expect(await prisma.foodLog.count()).toBe(0);
  expect(await prisma.foodLogNutrient.count()).toBe(0);
}

describe('direct authoritative FoodItem serving creation', () => {
  it.each([
    [{ quantity: 200, unit: 'g' }, 2, 202, 20.2, 11, 4.4, 100],
    [{ quantity: 50, unit: 'g' }, 0.5, 51, 5.1, 2.8, 1.1, 25],
  ])(
    'scales every persisted nutrient for %o',
    async (serving, multiplier, calories, protein, carbs, fat, sodium) => {
      const food = await trustedFood();
      const response = await request(food.id, { serving }).expect(200);

      expect(response.body.data).toMatchObject({
        calories,
        protein,
        carbs,
        fat,
        sodium,
        servingQuantity: serving.quantity,
        servingUnit: 'g',
        nutrients: {
          potassium: { amount: 120.1234 * multiplier, unit: 'mg' },
          vitaminC: { amount: 12.3456 * multiplier, unit: 'mg' },
        },
        servingSnapshot: {
          requestedServing: { quantity: serving.quantity, unit: 'g' },
          resolution: { multiplier },
          basisNutrition: { calories: 101, protein: 10.1 },
        },
      });
    },
  );

  it('converts kilograms and persists the canonical requested unit', async () => {
    const food = await trustedFood();
    const response = await request(food.id, {
      serving: { quantity: 0.5, unit: 'kilograms' },
    }).expect(200);

    expect(response.body.data).toMatchObject({
      calories: 505,
      servingQuantity: 0.5,
      servingUnit: 'kg',
      servingSnapshot: {
        requestedServing: { quantity: 0.5, unit: 'kg' },
        resolution: { multiplier: 5, reason: 'standard_mass_conversion' },
      },
    });
  });

  it('rejects a canonical quantity that cannot fit the existing serving column exactly', async () => {
    const food = await trustedFood();
    const response = await request(food.id, {
      serving: { quantity: 0.333, unit: 'kg' },
    }).expect(400);

    expectErrorEnvelope(response.body, 'INVALID_SERVING_REQUEST');
    expect(response.body.error.details).toEqual({ reason: 'invalid_quantity' });
    await expectNoWrites();
  });

  it('converts litres from a volume basis', async () => {
    const food = await trustedFood({
      servingQuantity: 250,
      servingUnit: 'ml',
      servingWeightGrams: null,
    });
    const response = await request(food.id, {
      serving: { quantity: 1, unit: 'litres' },
    }).expect(200);

    expect(response.body.data).toMatchObject({
      calories: 404,
      servingQuantity: 1,
      servingUnit: 'l',
      servingSnapshot: {
        requestedServing: { quantity: 1, unit: 'l' },
        resolution: { multiplier: 4, reason: 'standard_volume_conversion' },
      },
    });
  });

  it.each([
    ['egg-50g', 'egg', 2, 50, 100],
    ['slice-28g', 'slice', 3, 28, 84],
  ] as const)(
    'uses a selected trusted %s option and freezes it in the snapshot',
    async (id, unit, quantity, grams, expectedWeight) => {
      const food = await trustedFood({
        servingOptions: {
          schemaVersion: 1,
          options: [trustedOption(id, unit, grams)],
        },
      });
      const response = await request(food.id, {
        serving: { quantity, unit, servingOptionId: id },
      }).expect(200);

      expect(response.body.data.servingSnapshot).toMatchObject({
        requestedServing: {
          servingOptionId: id,
          selectedServingOption: { id, equivalentWeightGrams: grams },
        },
        resolution: {
          reason: 'trusted_serving_weight',
          resolvedWeightGrams: expectedWeight,
        },
      });
    },
  );

  it('resolves a bare cup only through a trusted food-specific option', async () => {
    const food = await trustedFood({
      servingOptions: {
        schemaVersion: 1,
        options: [trustedOption('cup-158g', 'cup', 158)],
      },
    });
    const response = await request(food.id, {
      serving: { quantity: 1, unit: 'cups', servingOptionId: 'cup-158g' },
    }).expect(200);

    expect(response.body.data.servingSnapshot).toMatchObject({
      requestedServing: { unit: 'cup', servingOptionId: 'cup-158g' },
      resolution: { reason: 'trusted_serving_weight', multiplier: 1.58 },
    });
  });

  it.each([
    [
      'missing selected option',
      { serving: { quantity: 1, unit: 'egg', servingOptionId: 'missing' } },
      400,
      'SERVING_RESOLUTION_INVALID',
      { reason: 'invalid_serving_option' },
    ],
    [
      'bare household request',
      { serving: { quantity: 1, unit: 'cup' } },
      422,
      'SERVING_NEEDS_REVIEW',
      { status: 'needs_review', reason: 'unknown_household_unit' },
    ],
    [
      'unsupported requested unit',
      { serving: { quantity: 1, unit: 'scoop' } },
      400,
      'INVALID_SERVING_REQUEST',
      { reason: 'unsupported_unit' },
    ],
  ])(
    'maps %s without writing rows',
    async (_label, payload, status, code, details) => {
      const food = await trustedFood();
      const response = await request(food.id, payload).expect(status);
      expectErrorEnvelope(response.body, code);
      expect(response.body.error.details).toEqual(details);
      await expectNoWrites();
    },
  );

  it.each([0, -1, 10_001])(
    'maps invalid requested quantity %p without writing rows',
    async (quantity) => {
      const food = await trustedFood();
      const response = await request(food.id, {
        serving: { quantity, unit: 'g' },
      }).expect(400);
      expectErrorEnvelope(response.body, 'INVALID_SERVING_REQUEST');
      await expectNoWrites();
    },
  );

  it('treats malformed stored serving options as no alternate options', async () => {
    const food = await trustedFood({
      servingOptions: { schemaVersion: 1, options: [] },
    });
    const response = await request(food.id, {
      serving: { quantity: 1, unit: 'egg' },
    }).expect(422);
    expectErrorEnvelope(response.body, 'SERVING_NEEDS_REVIEW');
    await expectNoWrites();
  });

  it('requires review for ambiguous options instead of selecting one', async () => {
    const food = await trustedFood({
      servingOptions: {
        schemaVersion: 1,
        options: [
          trustedOption('cup-small', 'cup', 140),
          trustedOption('cup-large', 'cup', 190),
        ],
      },
    });
    const response = await request(food.id, {
      serving: { quantity: 1, unit: 'cup' },
    }).expect(422);
    expectErrorEnvelope(response.body, 'SERVING_NEEDS_REVIEW');
    expect(response.body.error.details).toEqual({
      status: 'needs_review',
      reason: 'ambiguous_serving_option',
    });
    await expectNoWrites();
  });

  it.each([
    [2, 202, 200],
    [0.5, 51, 50],
  ])(
    'preserves legacy multiplier totals and writes canonical serving data for %p',
    async (servingMultiplier, calories, quantity) => {
      const food = await trustedFood();
      const response = await request(food.id, { servingMultiplier }).expect(
        200,
      );
      expect(response.body.data).toMatchObject({
        calories,
        servingQuantity: quantity,
        servingUnit: 'g',
        servingSnapshot: {
          requestedServing: { quantity, unit: 'g' },
          resolution: { multiplier: servingMultiplier },
        },
      });
    },
  );

  it('uses one canonical basis serving by default', async () => {
    const food = await trustedFood();
    const response = await request(food.id).expect(200);
    expect(response.body.data).toMatchObject({
      calories: 101,
      servingQuantity: 100,
      servingUnit: 'g',
      servingSnapshot: {
        requestedServing: { quantity: 100, unit: 'g' },
        resolution: { multiplier: 1 },
        nutritionOverride: null,
      },
    });
  });

  it('logs a repaired reference food with column nutrition kept out of normalized nutrients', async () => {
    const row: NormalizedProviderFood = {
      provider: 'ciqual',
      release: 'test-reference-serving-2026',
      sourceId: 'reference-banana-13005',
      name: 'Banana, flesh without skin, raw',
      authoritativeAliases: [],
      brandName: null,
      foodType: 'generic',
      category: 'Fruit',
      preparation: null,
      region: 'FR',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      nutrients: [
        {
          key: 'calories',
          amount: 88.6712,
          unit: 'kcal',
          sourceLabel: 'Energy',
          sourceUnit: 'kcal',
          sourceValue: '88.6712',
        },
        {
          key: 'protein',
          amount: 1.06,
          unit: 'g',
          sourceLabel: 'Protein',
          sourceUnit: 'g',
          sourceValue: '1.06',
        },
        {
          key: 'carbs',
          amount: 19.7,
          unit: 'g',
          sourceLabel: 'Carbohydrates',
          sourceUnit: 'g',
          sourceValue: '19.7',
        },
        {
          key: 'fat',
          amount: 0.5,
          unit: 'g',
          sourceLabel: 'Fat',
          sourceUnit: 'g',
          sourceValue: '0.5',
        },
        {
          key: 'fiber',
          amount: 2.7,
          unit: 'g',
          sourceLabel: 'Fiber',
          sourceUnit: 'g',
          sourceValue: '2.7',
        },
        {
          key: 'sodium',
          amount: 5,
          unit: 'mg',
          sourceLabel: 'Sodium',
          sourceUnit: 'mg',
          sourceValue: '5',
        },
        {
          key: 'potassium',
          amount: 320,
          unit: 'mg',
          sourceLabel: 'Potassium',
          sourceUnit: 'mg',
          sourceValue: '320',
        },
        {
          key: 'vitaminC',
          amount: 7.16,
          unit: 'mg',
          sourceLabel: 'Vitamin C',
          sourceUnit: 'mg',
          sourceValue: '7.16',
        },
      ],
      sourceRecordHash: 'reference-serving-banana-hash',
    };

    await prisma.foodDatasetRelease.deleteMany({
      where: { provider: row.provider, release: row.release },
    });
    await persistProviderFoods({
      prisma,
      rows: [row],
      sourceUri: 'https://example.test/ciqual-reference-serving.xlsx',
      sourceSha256: 'reference-serving-sha',
    });

    const food = await prisma.foodItem.findFirstOrThrow({
      where: {
        sourceProvider: 'ciqual',
        sourceId: row.sourceId,
        datasetRelease: row.release,
      },
      include: { nutrients: true },
    });
    expect(food.calories).toBe(89);
    expect(food.protein?.toNumber()).toBe(1.1);
    expect(food.nutrients.map((nutrient) => nutrient.nutrientKey)).toEqual([
      'potassium',
      'vitaminC',
    ]);

    const response = await request(food.id, {
      serving: { quantity: 200, unit: 'g' },
      nutritionOverride: {
        mode: 'complex',
        nutrientPatches: [
          { nutrientKey: 'potassium', state: 'known', amount: 0, unit: 'mg' },
          { nutrientKey: 'vitaminC', state: 'unknown' },
        ],
      },
    }).expect(200);

    expect(response.body.data).toMatchObject({
      calories: 178,
      protein: 2.2,
      carbs: 39.4,
      fiber: 5.4,
      sugar: null,
      nutrients: {
        potassium: { amount: 0, unit: 'mg' },
      },
      servingQuantity: 200,
      servingUnit: 'g',
      servingSnapshot: {
        requestedServing: { quantity: 200, unit: 'g' },
        basisNutrition: { calories: 89, protein: 1.1 },
      },
    });

    const persistedLog = await prisma.foodLog.findFirstOrThrow({
      where: { foodItemId: food.id },
      include: { nutrients: true },
    });
    expect(persistedLog.calories).toBe(178);
    expect(persistedLog.protein?.toNumber()).toBe(2.2);
    expect(persistedLog.servingQuantity?.toNumber()).toBe(200);
    expect(persistedLog.servingUnit).toBe('g');
    expect(persistedLog.servingSnapshot).toMatchObject({
      schemaVersion: 1,
      requestedServing: { quantity: 200, unit: 'g' },
      basisNutrition: { calories: 89, protein: 1.1 },
    });
    expect(persistedLog.nutrients).toMatchObject([
      { nutrientKey: 'potassium', amount: expect.anything(), unit: 'mg' },
    ]);
    expect(persistedLog.nutrients).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nutrientKey: 'vitaminC' }),
      ]),
    );
  });

  it('maps serving and multiplier conflict with no writes', async () => {
    const food = await trustedFood();
    const response = await request(food.id, {
      serving: { quantity: 100, unit: 'g' },
      servingMultiplier: 1,
    }).expect(400);
    expectErrorEnvelope(response.body, 'SERVING_CONFLICT');
    await expectNoWrites();
  });

  it('applies nutrition overrides once after scaling and snapshots their normalized effect', async () => {
    const food = await trustedFood();
    const response = await request(food.id, {
      servingMultiplier: 2,
      nutritionOverride: {
        mode: 'complex',
        calories: 89,
        protein: 7.76,
        carbs: null,
        sodium: 23,
        nutrients: { potassium: { amount: 9.87654, unit: 'mg' } },
      },
    }).expect(200);

    expect(response.body.data).toMatchObject({
      calories: 89,
      protein: 7.8,
      carbs: null,
      sodium: 23,
      nutrients: {
        potassium: { amount: 9.8765, unit: 'mg' },
        vitaminC: { amount: 24.6912, unit: 'mg' },
      },
      servingSnapshot: {
        basisNutrition: { calories: 101, protein: 10.1, carbs: 5.5 },
        nutritionOverride: {
          calories: { applied: true, value: 89 },
          protein: { applied: true, value: 7.8 },
          carbs: { applied: true, value: null },
          sodium: { applied: true, value: 23 },
        },
      },
    });
  });

  it('keeps FoodItem nutrition unchanged and does not duplicate scaled totals in the snapshot', async () => {
    const food = await trustedFood();
    const response = await request(food.id, { servingMultiplier: 2 }).expect(
      200,
    );
    const persistedFood = await prisma.foodItem.findUnique({
      where: { id: food.id },
      include: { nutrients: true },
    });

    expect(persistedFood?.calories).toBe(101);
    expect(persistedFood?.protein?.toNumber()).toBe(10.1);
    expect(persistedFood?.nutrients).toMatchObject([
      { nutrientKey: 'potassium', amount: expect.objectContaining({}) },
      { nutrientKey: 'vitaminC', amount: expect.objectContaining({}) },
    ]);
    expect(response.body.data.servingSnapshot.basisNutrition).toMatchObject({
      calories: 101,
      protein: 10.1,
    });
    expect(response.body.data.servingSnapshot).not.toHaveProperty(
      'finalNutrition',
    );
  });

  it('maps an unnormalizable stored basis without a fallback', async () => {
    const food = await trustedFood({ servingUnit: 'historical scoop' });
    const response = await request(food.id).expect(422);
    expectErrorEnvelope(response.body, 'INVALID_SERVING_BASIS');
    expect(response.body.error.details).toEqual({});
    await expectNoWrites();
  });

  it('leaves raw manual FoodLog creation without a serving snapshot', async () => {
    const response = await api
      .post('/api/v1/food-logs')
      .send({
        foodName: 'Manual meal',
        mealType: 'dinner',
        calories: 500,
        protein: 20,
        loggedAt,
      })
      .expect(200);
    expect(response.body.data.servingSnapshot).toBeNull();
  });

  it('serializes a malformed stored snapshot as null', async () => {
    const foodLog = await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Malformed snapshot',
        mealType: 'lunch',
        calories: 100,
        protein: 10,
        servingSnapshot: { malformed: true },
        loggedAt: new Date(loggedAt),
      },
    });

    const response = await api
      .get(`/api/v1/food-logs/${foodLog.id}`)
      .expect(200);
    expect(response.body.data).toMatchObject({
      id: foodLog.id,
      calories: 100,
      servingSnapshot: null,
    });
  });
});
