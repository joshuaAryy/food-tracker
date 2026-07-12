import { MOCK_USER_ID } from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const loggedAt = '2026-06-15T17:00:00.000Z';

type CandidateFoodOverrides = {
  name?: string;
  sourceType?: 'user_custom' | 'cached_external' | 'app_owned';
  sourceProvider?: 'usda_fdc' | null;
  sourceId?: string | null;
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

async function trustedCandidateFood(overrides: CandidateFoodOverrides = {}) {
  const name = overrides.name ?? 'Candidate serving food';
  return prisma.foodItem.create({
    data: {
      userId: MOCK_USER_ID,
      name,
      normalizedName: name.toLocaleLowerCase(),
      searchText: name.toLocaleLowerCase(),
      sourceType: overrides.sourceType ?? 'cached_external',
      sourceProvider:
        overrides.sourceProvider === undefined
          ? 'usda_fdc'
          : overrides.sourceProvider,
      sourceId:
        overrides.sourceId === undefined
          ? 'candidate-serving-100g'
          : overrides.sourceId,
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

function request(items: unknown[]) {
  return api.post('/api/v1/food-logs/from-candidates').send({
    mealType: 'breakfast',
    loggedAt,
    items,
  });
}

function localCandidate(
  foodItemId: string,
  extra: Record<string, unknown> = {},
) {
  return { candidateType: 'food_item', foodItemId, ...extra };
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

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.USDA_FDC_API_KEY;
});

describe('authoritative trusted candidate serving creation', () => {
  it('uses an explicit requested serving for a trusted local candidate', async () => {
    const food = await trustedCandidateFood();

    const response = await request([
      localCandidate(food.id, { serving: { quantity: 200, unit: 'grams' } }),
    ]).expect(200);

    expect(response.body.data.foodLogs[0]).toMatchObject({
      calories: 202,
      protein: 20.2,
      servingQuantity: 200,
      servingUnit: 'g',
      nutrients: { potassium: { amount: 240.2468, unit: 'mg' } },
      servingSnapshot: {
        requestedServing: { quantity: 200, unit: 'g' },
        resolution: { multiplier: 2 },
        provenance: { foodItemId: food.id, trustLevel: 'trusted' },
      },
    });
  });

  it.each([
    [{ quantity: 50, unit: 'g' }, 0.5, 51, 50, 'g'],
    [{ quantity: 0.5, unit: 'kilograms' }, 5, 505, 0.5, 'kg'],
  ])(
    'resolves %o to canonical candidate serving fields',
    async (serving, multiplier, calories, quantity, unit) => {
      const food = await trustedCandidateFood();
      const response = await request([
        localCandidate(food.id, { serving }),
      ]).expect(200);

      expect(response.body.data.foodLogs[0]).toMatchObject({
        calories,
        servingQuantity: quantity,
        servingUnit: unit,
        servingSnapshot: {
          requestedServing: { quantity, unit },
          resolution: { multiplier },
        },
      });
    },
  );

  it('converts a volume candidate and persists its complete nutrient snapshot', async () => {
    const food = await trustedCandidateFood({
      servingQuantity: 250,
      servingUnit: 'ml',
      servingWeightGrams: null,
    });
    const response = await request([
      localCandidate(food.id, { serving: { quantity: 1, unit: 'litres' } }),
    ]).expect(200);

    expect(response.body.data.foodLogs[0]).toMatchObject({
      calories: 404,
      servingQuantity: 1,
      servingUnit: 'l',
      nutrients: {
        potassium: { amount: 480.4936, unit: 'mg' },
        vitaminC: { amount: 49.3824, unit: 'mg' },
      },
      servingSnapshot: {
        requestedServing: { quantity: 1, unit: 'l' },
        resolution: { multiplier: 4, reason: 'standard_volume_conversion' },
      },
    });
  });

  it.each([
    ['egg-50g', 'egg', 2, 50],
    ['slice-28g', 'slice', 3, 28],
    ['cup-158g', 'cup', 1, 158],
  ] as const)(
    'freezes selected trusted %s option in the candidate snapshot',
    async (id, unit, quantity, grams) => {
      const food = await trustedCandidateFood({
        servingOptions: {
          schemaVersion: 1,
          options: [trustedOption(id, unit, grams)],
        },
      });
      const response = await request([
        localCandidate(food.id, {
          serving: { quantity, unit, servingOptionId: id },
        }),
      ]).expect(200);

      expect(response.body.data.foodLogs[0].servingSnapshot).toMatchObject({
        requestedServing: {
          servingOptionId: id,
          selectedServingOption: { id, unit },
        },
        resolution: { reason: 'trusted_serving_weight' },
      });
    },
  );

  it.each([
    [
      'malformed stored options as no options',
      { schemaVersion: 1, options: [] },
      { quantity: 1, unit: 'egg' },
      'SERVING_NEEDS_REVIEW',
      'incompatible_unit',
    ],
    [
      'missing selected option',
      null,
      { quantity: 1, unit: 'egg', servingOptionId: 'missing' },
      'SERVING_RESOLUTION_INVALID',
      'invalid_serving_option',
    ],
    [
      'ambiguous serving options',
      {
        schemaVersion: 1,
        options: [
          trustedOption('cup-small', 'cup', 140),
          trustedOption('cup-large', 'cup', 190),
        ],
      },
      { quantity: 1, unit: 'cup' },
      'SERVING_NEEDS_REVIEW',
      'ambiguous_serving_option',
    ],
    [
      'bare household serving without a relationship',
      null,
      { quantity: 1, unit: 'cup' },
      'SERVING_NEEDS_REVIEW',
      'unknown_household_unit',
    ],
  ] as const)(
    'maps %s without FoodLog writes',
    async (_label, servingOptions, serving, code, reason) => {
      const food = await trustedCandidateFood({ servingOptions });
      const response = await request([
        localCandidate(food.id, { serving }),
      ]).expect(code === 'SERVING_NEEDS_REVIEW' ? 422 : 400);

      expectErrorEnvelope(response.body, code);
      expect(response.body.error.details).toMatchObject({ reason });
      await expectNoFoodLogWrites();
    },
  );

  it.each([
    [2, 202, 200],
    [0.5, 51, 50],
    [undefined, 101, 100],
  ])(
    'preserves candidate legacy/default totals for multiplier %p',
    async (servingMultiplier, calories, quantity) => {
      const food = await trustedCandidateFood();
      const response = await request([
        localCandidate(
          food.id,
          servingMultiplier === undefined ? {} : { servingMultiplier },
        ),
      ]).expect(200);

      expect(response.body.data.foodLogs[0]).toMatchObject({
        calories,
        servingQuantity: quantity,
        servingUnit: 'g',
        servingSnapshot: {
          requestedServing: { quantity, unit: 'g' },
          resolution: { multiplier: servingMultiplier ?? 1 },
          nutritionOverride: null,
        },
      });
    },
  );

  it('uses explicit serving for cold USDA materialization and equivalent cached reuse', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            fdcId: 173944,
            description: 'Bananas, raw',
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 89, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 1.09, nutrient: { name: 'Protein', unitName: 'G' } },
              {
                amount: 358,
                nutrient: { name: 'Potassium, K', unitName: 'MG' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const item = {
      candidateType: 'external_food',
      sourceProvider: 'usda_fdc',
      sourceId: '173944',
      serving: { quantity: 200, unit: 'grams' },
    };

    const cold = await request([item]).expect(200);
    const cached = await request([item]).expect(200);
    const materialized = await prisma.foodItem.findFirst({
      where: { sourceProvider: 'usda_fdc', sourceId: '173944' },
    });
    if (materialized === null)
      throw new Error('expected materialized FoodItem');

    expect(cold.body.data.foodLogs[0]).toMatchObject({
      calories: 178,
      protein: 2.2,
      servingQuantity: 200,
      servingUnit: 'g',
      servingSnapshot: {
        requestedServing: { quantity: 200, unit: 'g' },
        provenance: {
          basisOrigin: 'food_item',
          sourceProvider: 'usda_fdc',
          sourceId: '173944',
          trustLevel: 'trusted',
          foodItemId: materialized.id,
        },
      },
    });
    expect(cached.body.data.foodLogs[0]).toMatchObject({
      calories: 178,
      protein: 2.2,
      servingSnapshot: {
        requestedServing: { quantity: 200, unit: 'g' },
        provenance: cold.body.data.foodLogs[0].servingSnapshot.provenance,
      },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await prisma.foodItem.update({
      where: { id: materialized.id },
      data: { calories: 300, protein: 30 },
    });
    const previous = await api
      .get(`/api/v1/food-logs/${cold.body.data.foodLogs[0].id as string}`)
      .expect(200);
    expect(previous.body.data).toMatchObject({
      calories: 178,
      protein: 2.2,
      servingSnapshot: {
        basisNutrition: { calories: 89, protein: 1.1 },
        provenance: { foodItemId: materialized.id },
      },
    });
  });

  it('maps a serving/multiplier candidate conflict to the stable code', async () => {
    const food = await trustedCandidateFood();
    const response = await request([
      localCandidate(food.id, {
        serving: { quantity: 100, unit: 'g' },
        servingMultiplier: 1,
      }),
    ]).expect(400);

    expectErrorEnvelope(response.body, 'SERVING_CONFLICT');
    await expectNoFoodLogWrites();
  });

  it('identifies a failed candidate item without persisting a previous FoodLog', async () => {
    const valid = await trustedCandidateFood({ name: 'First candidate' });
    const unresolved = await trustedCandidateFood({ name: 'Second candidate' });
    const response = await request([
      localCandidate(valid.id, { serving: { quantity: 200, unit: 'g' } }),
      localCandidate(unresolved.id, { serving: { quantity: 1, unit: 'cup' } }),
    ]).expect(422);

    expectErrorEnvelope(response.body, 'SERVING_NEEDS_REVIEW');
    expect(response.body.error.details).toEqual({
      status: 'needs_review',
      reason: 'unknown_household_unit',
      itemIndex: 1,
    });
    await expectNoFoodLogWrites();
  });

  it.each([
    [
      'an unnormalizable candidate basis',
      { servingUnit: 'historical scoop' },
      {},
      422,
      'INVALID_SERVING_BASIS',
    ],
    [
      'an unrepresentable requested candidate quantity',
      {},
      { serving: { quantity: 0.333, unit: 'kg' } },
      400,
      'INVALID_SERVING_REQUEST',
    ],
  ] as const)(
    'rejects %s without FoodLog writes',
    async (_label, foodOverrides, candidateOverrides, status, code) => {
      const food = await trustedCandidateFood(foodOverrides);
      const response = await request([
        localCandidate(food.id, candidateOverrides),
      ]).expect(status);

      expectErrorEnvelope(response.body, code);
      await expectNoFoodLogWrites();
    },
  );

  it('applies a candidate override once and preserves the FoodItem basis', async () => {
    const food = await trustedCandidateFood();
    const response = await request([
      localCandidate(food.id, {
        servingMultiplier: 2,
        nutritionOverride: {
          mode: 'complex',
          calories: 89,
          protein: 7.76,
          carbs: null,
          nutrients: { potassium: { amount: 9.87654, unit: 'mg' } },
        },
      }),
    ]).expect(200);

    expect(response.body.data.foodLogs[0]).toMatchObject({
      calories: 89,
      protein: 7.8,
      carbs: null,
      nutrients: {
        potassium: { amount: 9.8765, unit: 'mg' },
        vitaminC: { amount: 24.6912, unit: 'mg' },
      },
      servingSnapshot: {
        basisNutrition: { calories: 101, protein: 10.1 },
        nutritionOverride: {
          calories: { applied: true, value: 89 },
          protein: { applied: true, value: 7.8 },
          carbs: { applied: true, value: null },
        },
      },
    });
    const persisted = await prisma.foodItem.findUnique({
      where: { id: food.id },
    });
    expect(persisted?.calories).toBe(101);
    expect(persisted?.protein?.toNumber()).toBe(10.1);
  });

  it('keeps an earlier candidate snapshot immutable after the FoodItem changes', async () => {
    const food = await trustedCandidateFood();
    const created = await request([
      localCandidate(food.id, { serving: { quantity: 200, unit: 'g' } }),
    ]).expect(200);

    await prisma.foodItem.update({
      where: { id: food.id },
      data: {
        calories: 200,
        protein: 20,
        nutrients: {
          deleteMany: {},
          create: { nutrientKey: 'potassium', amount: 500, unit: 'mg' },
        },
      },
    });

    const fetched = await api
      .get(`/api/v1/food-logs/${created.body.data.foodLogs[0].id as string}`)
      .expect(200);
    expect(fetched.body.data).toMatchObject({
      calories: 202,
      nutrients: {
        potassium: { amount: 240.2468, unit: 'mg' },
        vitaminC: { amount: 24.6912, unit: 'mg' },
      },
      servingSnapshot: {
        basisNutrition: { calories: 101, protein: 10.1 },
        provenance: { foodItemId: food.id },
      },
    });
  });

  it('rolls back cold candidate materialization when serving persistence is rejected', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              fdcId: 999,
              description: 'Rejected USDA food',
              dataType: 'Foundation',
              foodNutrients: [
                { amount: 100, nutrient: { name: 'Energy', unitName: 'KCAL' } },
                { amount: 10, nutrient: { name: 'Protein', unitName: 'G' } },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await request([
      {
        candidateType: 'external_food',
        sourceProvider: 'usda_fdc',
        sourceId: '999',
        serving: { quantity: 0.333, unit: 'kg' },
      },
    ]).expect(400);

    expectErrorEnvelope(response.body, 'INVALID_SERVING_REQUEST');
    expect(await prisma.foodItem.count({ where: { sourceId: '999' } })).toBe(0);
    await expectNoFoodLogWrites();
  });

  it('preserves candidate ownership checks', async () => {
    const otherUserId = '00000000-0000-4000-8000-000000000002';
    await prisma.user.create({ data: { id: otherUserId } });
    const food = await prisma.foodItem.create({
      data: {
        userId: otherUserId,
        name: 'Private candidate',
        normalizedName: 'private candidate',
        searchText: 'private candidate',
        sourceType: 'user_custom',
        foodType: 'generic',
        servingQuantity: 100,
        servingUnit: 'g',
        calories: 100,
        protein: 10,
      },
    });
    const response = await request([localCandidate(food.id)]).expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
    await expectNoFoodLogWrites();
  });
});
