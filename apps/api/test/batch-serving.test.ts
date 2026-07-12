import { MOCK_USER_ID } from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const loggedAt = '2026-06-15T17:00:00.000Z';

type FoodOverrides = {
  calories?: number;
  protein?: number;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
  servingQuantity?: number;
  servingUnit?: string;
  servingWeightGrams?: number | null;
  servingOptions?: Prisma.InputJsonValue | null;
  nutrients?: Array<{
    nutrientKey: 'potassium' | 'vitaminC';
    amount: number;
    unit: 'mg';
  }>;
};

async function trustedFood(name: string, overrides: FoodOverrides = {}) {
  return prisma.foodItem.create({
    data: {
      userId: MOCK_USER_ID,
      name,
      normalizedName: name.toLocaleLowerCase(),
      searchText: name.toLocaleLowerCase(),
      sourceType: 'cached_external',
      sourceProvider: 'usda_fdc',
      sourceId: `${name.toLocaleLowerCase()}-source`,
      foodType: 'generic',
      servingQuantity: overrides.servingQuantity ?? 100,
      servingUnit: overrides.servingUnit ?? 'g',
      servingWeightGrams:
        overrides.servingWeightGrams === undefined
          ? 100
          : overrides.servingWeightGrams,
      servingOptions:
        overrides.servingOptions === undefined ||
        overrides.servingOptions === null
          ? Prisma.JsonNull
          : overrides.servingOptions,
      calories: overrides.calories ?? 100,
      protein: overrides.protein ?? 10,
      carbs: overrides.carbs ?? 5,
      fat: overrides.fat ?? 2,
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

function request(items: unknown[]) {
  return api.post('/api/v1/food-logs/from-food-items').send({
    mealType: 'lunch',
    loggedAt,
    items,
  });
}

function item(foodItemId: string, extra: Record<string, unknown> = {}) {
  return { foodItemId, ...extra };
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

async function expectNoFoodLogWrites() {
  expect(await prisma.foodLog.count()).toBe(0);
  expect(await prisma.foodLogNutrient.count()).toBe(0);
}

describe('authoritative batch FoodItem serving creation', () => {
  it('persists two explicit requested servings with independent snapshots', async () => {
    const first = await trustedFood('First batch food');
    const second = await trustedFood('Second batch food', {
      calories: 80,
      protein: 8,
    });

    const response = await api
      .post('/api/v1/food-logs/from-food-items')
      .send({
        mealType: 'lunch',
        loggedAt,
        items: [
          {
            foodItemId: first.id,
            serving: { quantity: 200, unit: 'grams' },
          },
          {
            foodItemId: second.id,
            serving: { quantity: 50, unit: 'g' },
          },
        ],
      })
      .expect(200);

    expect(response.body.data.foodLogs).toEqual([
      expect.objectContaining({
        foodItemId: first.id,
        calories: 200,
        protein: 20,
        servingQuantity: 200,
        servingUnit: 'g',
        servingSnapshot: expect.objectContaining({
          requestedServing: expect.objectContaining({
            quantity: 200,
            unit: 'g',
          }),
          resolution: expect.objectContaining({ multiplier: 2 }),
        }),
      }),
      expect.objectContaining({
        foodItemId: second.id,
        calories: 40,
        protein: 4,
        servingQuantity: 50,
        servingUnit: 'g',
        servingSnapshot: expect.objectContaining({
          requestedServing: expect.objectContaining({
            quantity: 50,
            unit: 'g',
          }),
          resolution: expect.objectContaining({ multiplier: 0.5 }),
        }),
      }),
    ]);
  });

  it('handles mixed converted, legacy, and default batch servings', async () => {
    const volume = await trustedFood('Volume batch food', {
      servingQuantity: 250,
      servingUnit: 'ml',
      servingWeightGrams: null,
    });
    const legacy = await trustedFood('Legacy batch food');
    const defaultFood = await trustedFood('Default batch food', {
      calories: 80,
      protein: 8,
    });

    const response = await request([
      item(volume.id, { serving: { quantity: 1, unit: 'litres' } }),
      item(legacy.id, { servingMultiplier: 0.5 }),
      item(defaultFood.id),
    ]).expect(200);

    expect(response.body.data.foodLogs).toMatchObject([
      {
        calories: 400,
        servingQuantity: 1,
        servingUnit: 'l',
        servingSnapshot: {
          resolution: { multiplier: 4, reason: 'standard_volume_conversion' },
        },
      },
      {
        calories: 50,
        servingQuantity: 50,
        servingUnit: 'g',
        servingSnapshot: { resolution: { multiplier: 0.5 } },
      },
      {
        calories: 80,
        servingQuantity: 100,
        servingUnit: 'g',
        servingSnapshot: { resolution: { multiplier: 1 } },
      },
    ]);
  });

  it.each([
    [2, 200, 200],
    [0.5, 50, 50],
  ])(
    'preserves legacy batch multiplier %p totals and writes a snapshot',
    async (servingMultiplier, calories, servingQuantity) => {
      const food = await trustedFood(`Legacy multiplier ${servingMultiplier}`);
      const response = await request([
        item(food.id, { servingMultiplier }),
      ]).expect(200);

      expect(response.body.data.foodLogs[0]).toMatchObject({
        calories,
        servingQuantity,
        servingUnit: 'g',
        servingSnapshot: {
          requestedServing: { quantity: servingQuantity, unit: 'g' },
          resolution: { multiplier: servingMultiplier },
        },
      });
    },
  );

  it('freezes independently selected egg and slice options in batch snapshots', async () => {
    const eggs = await trustedFood('Batch eggs', {
      servingOptions: {
        schemaVersion: 1,
        options: [trustedOption('egg-50g', 'egg', 50)],
      },
    });
    const slices = await trustedFood('Batch slices', {
      servingOptions: {
        schemaVersion: 1,
        options: [trustedOption('slice-28g', 'slice', 28)],
      },
    });
    const response = await request([
      item(eggs.id, {
        serving: { quantity: 2, unit: 'egg', servingOptionId: 'egg-50g' },
      }),
      item(slices.id, {
        serving: { quantity: 3, unit: 'slice', servingOptionId: 'slice-28g' },
      }),
    ]).expect(200);

    expect(response.body.data.foodLogs).toMatchObject([
      {
        calories: 100,
        servingSnapshot: {
          requestedServing: {
            servingOptionId: 'egg-50g',
            selectedServingOption: { id: 'egg-50g', unit: 'egg' },
          },
          resolution: { reason: 'trusted_serving_weight' },
        },
      },
      {
        calories: 84,
        servingSnapshot: {
          requestedServing: {
            servingOptionId: 'slice-28g',
            selectedServingOption: { id: 'slice-28g', unit: 'slice' },
          },
          resolution: { reason: 'trusted_serving_weight' },
        },
      },
    ]);
  });

  it('resolves a bare cup only through its selected trusted relationship', async () => {
    const food = await trustedFood('Trusted batch cup', {
      servingOptions: {
        schemaVersion: 1,
        options: [trustedOption('cup-180g', 'cup', 180)],
      },
    });
    const response = await request([
      item(food.id, {
        serving: { quantity: 1, unit: 'cup', servingOptionId: 'cup-180g' },
      }),
    ]).expect(200);

    expect(response.body.data.foodLogs[0]).toMatchObject({
      calories: 180,
      servingQuantity: 1,
      servingUnit: 'cup',
      servingSnapshot: {
        requestedServing: {
          servingOptionId: 'cup-180g',
          selectedServingOption: { id: 'cup-180g' },
        },
        resolution: { reason: 'trusted_serving_weight' },
      },
    });
  });

  it.each([
    [
      'malformed stored options as no options',
      { schemaVersion: 1, options: [] },
      { quantity: 1, unit: 'egg' },
      422,
      'SERVING_NEEDS_REVIEW',
      'incompatible_unit',
    ],
    [
      'a missing selected option',
      null,
      { quantity: 1, unit: 'egg', servingOptionId: 'missing' },
      400,
      'SERVING_RESOLUTION_INVALID',
      'invalid_serving_option',
    ],
    [
      'ambiguous cup options',
      {
        schemaVersion: 1,
        options: [
          trustedOption('cup-small', 'cup', 140),
          trustedOption('cup-large', 'cup', 190),
        ],
      },
      { quantity: 1, unit: 'cup' },
      422,
      'SERVING_NEEDS_REVIEW',
      'ambiguous_serving_option',
    ],
    [
      'an unbridged bare household unit',
      null,
      { quantity: 1, unit: 'cup' },
      422,
      'SERVING_NEEDS_REVIEW',
      'unknown_household_unit',
    ],
  ] as const)(
    'rejects %s atomically with a safe item index',
    async (_label, servingOptions, serving, status, code, reason) => {
      const valid = await trustedFood('Valid before rejected batch item');
      const rejected = await trustedFood('Rejected batch item', {
        servingOptions,
      });
      const response = await request([
        item(valid.id, { serving: { quantity: 200, unit: 'g' } }),
        item(rejected.id, { serving }),
      ]).expect(status);

      expectErrorEnvelope(response.body, code);
      expect(response.body.error.details).toMatchObject({
        reason,
        itemIndex: 1,
      });
      await expectNoFoodLogWrites();
    },
  );

  it('applies each batch override after scaling exactly once', async () => {
    const overridden = await trustedFood('Overridden batch food');
    const unchanged = await trustedFood('Unchanged batch food');
    const response = await request([
      item(overridden.id, {
        servingMultiplier: 2,
        nutritionOverride: {
          mode: 'complex',
          calories: 89,
          protein: 7.76,
          carbs: null,
          sodium: 23,
          nutrients: { potassium: { amount: 9.87654, unit: 'mg' } },
        },
      }),
      item(unchanged.id, { servingMultiplier: 2 }),
    ]).expect(200);

    expect(response.body.data.foodLogs).toMatchObject([
      {
        calories: 89,
        protein: 7.8,
        carbs: null,
        sodium: 23,
        nutrients: {
          potassium: { amount: 9.8765, unit: 'mg' },
          vitaminC: { amount: 24.6912, unit: 'mg' },
        },
        servingSnapshot: {
          basisNutrition: { calories: 100, protein: 10 },
          nutritionOverride: {
            calories: { applied: true, value: 89 },
            protein: { applied: true, value: 7.8 },
          },
        },
      },
      {
        calories: 200,
        protein: 20,
        servingSnapshot: { nutritionOverride: null },
      },
    ]);
  });

  it('maps one item serving/multiplier conflict without writes', async () => {
    const valid = await trustedFood('Valid before conflict');
    const conflicting = await trustedFood('Conflicting batch item');
    const response = await request([
      item(valid.id, { serving: { quantity: 200, unit: 'g' } }),
      item(conflicting.id, {
        serving: { quantity: 100, unit: 'g' },
        servingMultiplier: 1,
      }),
    ]).expect(400);

    expectErrorEnvelope(response.body, 'SERVING_CONFLICT');
    expect(response.body.error.details).toEqual({ itemIndex: 1 });
    await expectNoFoodLogWrites();
  });

  it('maps an invalid requested batch unit without partial writes', async () => {
    const valid = await trustedFood('Valid before invalid unit');
    const invalid = await trustedFood('Invalid unit batch food');
    const response = await request([
      item(valid.id, { serving: { quantity: 200, unit: 'g' } }),
      item(invalid.id, { serving: { quantity: 1, unit: 'scoop' } }),
    ]).expect(400);

    expectErrorEnvelope(response.body, 'INVALID_SERVING_REQUEST');
    expect(response.body.error.details).toEqual({
      reason: 'unsupported_unit',
      itemIndex: 1,
    });
    await expectNoFoodLogWrites();
  });

  it('rejects a batch quantity that cannot fit the FoodLog column exactly', async () => {
    const valid = await trustedFood('Valid before precision failure');
    const unrepresentable = await trustedFood('Unrepresentable batch food');
    const response = await request([
      item(valid.id, { serving: { quantity: 200, unit: 'g' } }),
      item(unrepresentable.id, { serving: { quantity: 0.333, unit: 'kg' } }),
    ]).expect(400);

    expectErrorEnvelope(response.body, 'INVALID_SERVING_REQUEST');
    expect(response.body.error.details).toEqual({
      reason: 'invalid_quantity',
      itemIndex: 1,
    });
    await expectNoFoodLogWrites();
  });

  it('maps an invalid stored batch basis without a legacy fallback', async () => {
    const valid = await trustedFood('Valid before invalid batch basis');
    const invalidBasis = await trustedFood('Invalid batch basis', {
      servingUnit: 'historical scoop',
    });
    const response = await request([
      item(valid.id, { serving: { quantity: 200, unit: 'g' } }),
      item(invalidBasis.id),
    ]).expect(422);

    expectErrorEnvelope(response.body, 'INVALID_SERVING_BASIS');
    expect(response.body.error.details).toEqual({ itemIndex: 1 });
    await expectNoFoodLogWrites();
  });

  it('preserves ownership checks without persisting a preceding batch item', async () => {
    const valid = await trustedFood('Valid before private batch food');
    const otherUserId = '00000000-0000-4000-8000-000000000002';
    await prisma.user.create({ data: { id: otherUserId } });
    const privateFood = await prisma.foodItem.create({
      data: {
        userId: otherUserId,
        name: 'Private batch food',
        normalizedName: 'private batch food',
        searchText: 'private batch food',
        sourceType: 'user_custom',
        foodType: 'generic',
        servingQuantity: 100,
        servingUnit: 'g',
        calories: 100,
        protein: 10,
      },
    });
    const response = await request([
      item(valid.id, { serving: { quantity: 200, unit: 'g' } }),
      item(privateFood.id),
    ]).expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
    await expectNoFoodLogWrites();
  });

  it('persists every normalized nutrient with its original unit for each batch item', async () => {
    const first = await trustedFood('Nutrient first batch food');
    const second = await trustedFood('Nutrient second batch food', {
      nutrients: [{ nutrientKey: 'vitaminC', amount: 30.5555, unit: 'mg' }],
    });
    const response = await request([
      item(first.id, { serving: { quantity: 200, unit: 'g' } }),
      item(second.id, { servingMultiplier: 0.5 }),
    ]).expect(200);
    const ids = response.body.data.foodLogs.map(
      (foodLog: { id: string }) => foodLog.id,
    );
    const persisted = await prisma.foodLog.findMany({
      where: { id: { in: ids } },
      include: { nutrients: { orderBy: { nutrientKey: 'asc' } } },
      orderBy: { foodName: 'asc' },
    });

    expect(response.body.data.foodLogs).toMatchObject([
      {
        nutrients: {
          potassium: { amount: 240.2468, unit: 'mg' },
          vitaminC: { amount: 24.6912, unit: 'mg' },
        },
      },
      { nutrients: { vitaminC: { amount: 15.2778, unit: 'mg' } } },
    ]);
    expect(persisted.flatMap((foodLog) => foodLog.nutrients)).toHaveLength(3);
    expect(
      persisted
        .flatMap((foodLog) => foodLog.nutrients)
        .map((nutrient) => nutrient.unit),
    ).toEqual(['mg', 'mg', 'mg']);
  });

  it('keeps a stored batch snapshot immutable after its FoodItem changes', async () => {
    const food = await trustedFood('Immutable batch source');
    const created = await request([
      item(food.id, { serving: { quantity: 200, unit: 'g' } }),
    ]).expect(200);

    await prisma.foodItem.update({
      where: { id: food.id },
      data: { calories: 300, protein: 30 },
    });

    const fetched = await api
      .get(`/api/v1/food-logs/${created.body.data.foodLogs[0].id as string}`)
      .expect(200);
    expect(fetched.body.data).toMatchObject({
      calories: 200,
      protein: 20,
      servingSnapshot: {
        basisNutrition: { calories: 100, protein: 10 },
        provenance: { foodItemId: food.id },
      },
    });
  });
});
