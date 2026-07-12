import { MOCK_USER_ID } from '@food-tracker/shared';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const loggedAt = '2026-06-15T17:00:00.000Z';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

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
      name: 'Update basis food',
      normalizedName: 'update basis food',
      searchText: 'update basis food',
      sourceType: 'cached_external',
      sourceProvider: 'usda_fdc',
      sourceId: 'update-100g',
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

function createRequest(
  foodItemId: string,
  extra: Record<string, unknown> = {},
) {
  return api.post('/api/v1/food-logs/from-food-item').send({
    foodItemId,
    mealType: 'breakfast',
    loggedAt,
    ...extra,
  });
}

async function createSnapshotLog(
  input: {
    foodOverrides?: FoodOverrides;
    request?: Record<string, unknown>;
  } = {},
) {
  const food = await trustedFood(input.foodOverrides);
  const response = await createRequest(food.id, input.request).expect(200);
  return { food, foodLogId: response.body.data.id as string };
}

async function readLog(id: string) {
  const response = await api.get(`/api/v1/food-logs/${id}`).expect(200);
  return response.body.data;
}

async function expectUnchanged(id: string, before: unknown) {
  expect(await readLog(id)).toEqual(before);
}

async function ensureOtherUser() {
  await prisma.user.upsert({
    where: { id: OTHER_USER_ID },
    create: { id: OTHER_USER_ID },
    update: {},
  });
}

describe('snapshot-backed FoodLog serving updates', () => {
  it.each([
    [{ quantity: 200, unit: 'g' }, 202, 20.2, 11, 4.4, 100],
    [{ quantity: 50, unit: 'g' }, 51, 5.1, 2.8, 1.1, 25],
  ])(
    'recalculates every persisted nutrient for %o',
    async (serving, calories, protein, carbs, fat, sodium) => {
      const { foodLogId } = await createSnapshotLog();

      const response = await api
        .put(`/api/v1/food-logs/${foodLogId}`)
        .send({ serving })
        .expect(200);

      expect(response.body.data).toMatchObject({
        calories,
        protein,
        carbs,
        fat,
        sodium,
        servingQuantity: serving.quantity,
        servingUnit: 'g',
        nutrients: {
          potassium: {
            amount: serving.quantity === 200 ? 240.2468 : 60.0617,
            unit: 'mg',
          },
          vitaminC: {
            amount: serving.quantity === 200 ? 24.6912 : 6.1728,
            unit: 'mg',
          },
        },
        servingSnapshot: {
          requestedServing: { quantity: serving.quantity, unit: 'g' },
          basisNutrition: {
            calories: 101,
            protein: 10.1,
            nutrients: { potassium: { amount: 120.1234, unit: 'mg' } },
          },
          nutritionOverride: null,
        },
      });
      expect(response.body.data.fiber).toBeNull();
      expect(response.body.data.sugar).toBeNull();
    },
  );

  it('converts standard mass units and stores the canonical requested unit', async () => {
    const { foodLogId } = await createSnapshotLog();
    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ serving: { quantity: 0.5, unit: 'kilograms' } })
      .expect(200);

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

  it('converts standard volume units from the stored snapshot basis', async () => {
    const { foodLogId } = await createSnapshotLog({
      foodOverrides: {
        servingQuantity: 250,
        servingUnit: 'ml',
        servingWeightGrams: null,
      },
    });
    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ serving: { quantity: 1, unit: 'litres' } })
      .expect(200);

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

  it('uses the historical snapshot nutrition when the FoodItem changes', async () => {
    const { food, foodLogId } = await createSnapshotLog();
    await prisma.foodItem.update({
      where: { id: food.id },
      data: {
        calories: 999,
        protein: 99.9,
        carbs: 99.9,
        nutrients: {
          deleteMany: {},
          create: { nutrientKey: 'potassium', amount: 999.9999, unit: 'mg' },
        },
      },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ serving: { quantity: 200, unit: 'g' } })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 202,
      protein: 20.2,
      carbs: 11,
      nutrients: {
        potassium: { amount: 240.2468, unit: 'mg' },
        vitaminC: { amount: 24.6912, unit: 'mg' },
      },
      servingSnapshot: { basisNutrition: { calories: 101, protein: 10.1 } },
    });
  });

  it('does not need a deleted FoodItem for a standard-unit recalculation', async () => {
    const { food, foodLogId } = await createSnapshotLog();
    await prisma.foodItem.delete({ where: { id: food.id } });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ serving: { quantity: 200, unit: 'g' } })
      .expect(200);

    expect(response.body.data).toMatchObject({
      foodItemId: null,
      calories: 202,
      servingSnapshot: {
        provenance: { foodItemId: food.id, sourceProvider: 'usda_fdc' },
      },
    });
  });

  it('reuses a frozen egg option after the FoodItem is deleted', async () => {
    const option = trustedOption('egg-50g', 'egg', 50);
    const { food, foodLogId } = await createSnapshotLog({
      foodOverrides: {
        servingOptions: { schemaVersion: 1, options: [option] },
      },
      request: {
        serving: { quantity: 2, unit: 'egg', servingOptionId: option.id },
      },
    });
    await prisma.foodItem.delete({ where: { id: food.id } });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        serving: { quantity: 3, unit: 'eggs', servingOptionId: option.id },
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 152,
      servingQuantity: 3,
      servingUnit: 'egg',
      servingSnapshot: {
        requestedServing: {
          servingOptionId: option.id,
          selectedServingOption: option,
        },
        resolution: { multiplier: 1.5, reason: 'trusted_serving_weight' },
      },
    });
  });

  it('reuses a frozen slice option when current options change', async () => {
    const slice = trustedOption('slice-28g', 'slice', 28);
    const { food, foodLogId } = await createSnapshotLog({
      foodOverrides: { servingOptions: { schemaVersion: 1, options: [slice] } },
      request: {
        serving: { quantity: 1, unit: 'slice', servingOptionId: slice.id },
      },
    });
    await prisma.foodItem.update({
      where: { id: food.id },
      data: {
        servingOptions: {
          schemaVersion: 1,
          options: [trustedOption('egg-50g', 'egg', 50)],
        },
      },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        serving: { quantity: 3, unit: 'slice', servingOptionId: slice.id },
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 85,
      servingSnapshot: {
        requestedServing: {
          servingOptionId: slice.id,
          selectedServingOption: slice,
        },
        resolution: { multiplier: 0.84, reason: 'trusted_serving_weight' },
      },
    });
  });

  it('loads and freezes a different current FoodItem option without changing the historical basis', async () => {
    const egg = trustedOption('egg-50g', 'egg', 50);
    const slice = trustedOption('slice-28g', 'slice', 28);
    const { foodLogId } = await createSnapshotLog({
      foodOverrides: {
        servingOptions: { schemaVersion: 1, options: [egg, slice] },
      },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        serving: { quantity: 3, unit: 'slices', servingOptionId: slice.id },
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 85,
      protein: 8.5,
      servingQuantity: 3,
      servingUnit: 'slice',
      servingSnapshot: {
        basisNutrition: { calories: 101, protein: 10.1 },
        requestedServing: {
          servingOptionId: slice.id,
          selectedServingOption: slice,
        },
      },
    });
  });

  it.each([
    ['a missing current FoodItem', 'delete-food'],
    ['a missing current option', 'missing-option'],
    ['malformed current options', 'malformed-options'],
  ])('rejects %s for a newly selected option', async (_label, caseName) => {
    const egg = trustedOption('egg-50g', 'egg', 50);
    const slice = trustedOption('slice-28g', 'slice', 28);
    const { food, foodLogId } = await createSnapshotLog({
      foodOverrides: {
        servingOptions: { schemaVersion: 1, options: [egg, slice] },
      },
    });

    if (caseName === 'delete-food') {
      await prisma.foodItem.delete({ where: { id: food.id } });
    } else if (caseName === 'missing-option') {
      await prisma.foodItem.update({
        where: { id: food.id },
        data: { servingOptions: { schemaVersion: 1, options: [egg] } },
      });
    } else {
      await prisma.foodItem.update({
        where: { id: food.id },
        data: { servingOptions: { schemaVersion: 1, options: [] } },
      });
    }
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        serving: { quantity: 1, unit: 'slice', servingOptionId: slice.id },
      })
      .expect(422);

    expectErrorEnvelope(response.body, 'SERVING_OPTION_UNAVAILABLE');
    await expectUnchanged(foodLogId, before);
  });

  it('does not use another user’s FoodItem option', async () => {
    await ensureOtherUser();
    const egg = trustedOption('egg-50g', 'egg', 50);
    const slice = trustedOption('slice-28g', 'slice', 28);
    const { food, foodLogId } = await createSnapshotLog({
      foodOverrides: {
        servingOptions: { schemaVersion: 1, options: [egg, slice] },
      },
    });
    const before = await readLog(foodLogId);
    await prisma.foodItem.update({
      where: { id: food.id },
      data: { userId: OTHER_USER_ID },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        serving: { quantity: 1, unit: 'slice', servingOptionId: slice.id },
      })
      .expect(422);

    expectErrorEnvelope(response.body, 'SERVING_OPTION_UNAVAILABLE');
    await expectUnchanged(foodLogId, before);
  });

  it.each([
    [
      'a bare household serving without a trusted option',
      { serving: { quantity: 1, unit: 'cup' } },
      'unknown_household_unit',
    ],
    [
      'a mass-to-volume request without a bridge',
      { serving: { quantity: 100, unit: 'ml' } },
      'incompatible_unit',
    ],
  ])('maps %s to needs review without writes', async (_label, body, reason) => {
    const { foodLogId } = await createSnapshotLog();
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send(body)
      .expect(422);

    expectErrorEnvelope(response.body, 'SERVING_NEEDS_REVIEW');
    expect(response.body.error.details).toEqual({
      status: 'needs_review',
      reason,
    });
    await expectUnchanged(foodLogId, before);
  });

  it('preserves the resolver ambiguity behavior when no option is selected', async () => {
    const { foodLogId } = await createSnapshotLog({
      foodOverrides: {
        servingOptions: {
          schemaVersion: 1,
          options: [
            trustedOption('egg-50g', 'egg', 50),
            trustedOption('egg-60g', 'egg', 60),
          ],
        },
      },
    });
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ serving: { quantity: 2, unit: 'egg' } })
      .expect(422);

    expectErrorEnvelope(response.body, 'SERVING_NEEDS_REVIEW');
    expect(response.body.error.details).toEqual({
      status: 'needs_review',
      reason: 'ambiguous_serving_option',
    });
    await expectUnchanged(foodLogId, before);
  });

  it('treats malformed current options as no options when none is selected', async () => {
    const { food, foodLogId } = await createSnapshotLog();
    await prisma.foodItem.update({
      where: { id: food.id },
      data: { servingOptions: { schemaVersion: 1, options: [] } },
    });
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ serving: { quantity: 1, unit: 'cup' } })
      .expect(422);

    expectErrorEnvelope(response.body, 'SERVING_NEEDS_REVIEW');
    expect(response.body.error.details).toEqual({
      status: 'needs_review',
      reason: 'unknown_household_unit',
    });
    await expectUnchanged(foodLogId, before);
  });

  it('maps an incompatible selected current option through the shared resolver', async () => {
    const egg = trustedOption('egg-50g', 'egg', 50);
    const { foodLogId } = await createSnapshotLog({
      foodOverrides: {
        servingQuantity: 250,
        servingUnit: 'ml',
        servingWeightGrams: null,
        servingOptions: { schemaVersion: 1, options: [egg] },
      },
    });
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ serving: { quantity: 1, unit: 'egg', servingOptionId: egg.id } })
      .expect(400);

    expectErrorEnvelope(response.body, 'SERVING_RESOLUTION_INVALID');
    expect(response.body.error.details).toEqual({
      reason: 'invalid_serving_option',
    });
    await expectUnchanged(foodLogId, before);
  });

  it.each([
    [
      'an invalid requested quantity',
      { serving: { quantity: 0, unit: 'g' } },
      'INVALID_SERVING_REQUEST',
      400,
    ],
    [
      'an unrepresentable canonical requested quantity',
      { serving: { quantity: 0.333, unit: 'kg' } },
      'INVALID_SERVING_REQUEST',
      400,
    ],
  ])(
    'rejects %s without changing the stored log',
    async (_label, body, code, status) => {
      const { foodLogId } = await createSnapshotLog();
      const before = await readLog(foodLogId);

      const response = await api
        .put(`/api/v1/food-logs/${foodLogId}`)
        .send(body)
        .expect(status);

      expectErrorEnvelope(response.body, code);
      await expectUnchanged(foodLogId, before);
    },
  );

  it('requires an explicit override action when a serving change would discard one', async () => {
    const { foodLogId } = await createSnapshotLog({
      request: {
        nutritionOverride: { mode: 'complex', calories: 300, protein: 30 },
      },
    });
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ serving: { quantity: 200, unit: 'g' } })
      .expect(409);

    expectErrorEnvelope(response.body, 'SERVING_OVERRIDE_ACTION_REQUIRED');
    await expectUnchanged(foodLogId, before);
  });

  it('clears an existing override and recalculates from the historical basis', async () => {
    const { foodLogId } = await createSnapshotLog({
      request: {
        nutritionOverride: { mode: 'complex', calories: 300, protein: 30 },
      },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        serving: { quantity: 200, unit: 'g' },
        clearNutritionOverride: true,
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 202,
      protein: 20.2,
      servingSnapshot: {
        nutritionOverride: null,
        basisNutrition: { calories: 101, protein: 10.1 },
      },
    });
  });

  it('replaces an existing override after recalculating the requested serving', async () => {
    const { foodLogId } = await createSnapshotLog({
      request: { nutritionOverride: { mode: 'complex', calories: 300 } },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        serving: { quantity: 200, unit: 'g' },
        nutritionOverride: {
          mode: 'complex',
          calories: 333,
          protein: 32.26,
          sodium: 90,
          nutrients: { potassium: { amount: 999.12345, unit: 'mg' } },
        },
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 333,
      protein: 32.3,
      sodium: 90,
      nutrients: {
        potassium: { amount: 999.1235, unit: 'mg' },
        vitaminC: { amount: 24.6912, unit: 'mg' },
      },
      servingSnapshot: {
        nutritionOverride: {
          semantics: 'post_scale_absolute_v1',
          calories: { applied: true, value: 333 },
          protein: { applied: true, value: 32.3 },
          sodium: { applied: true, value: 90 },
          nutrients: {
            applied: true,
            value: { potassium: { amount: 999.1235, unit: 'mg' } },
          },
        },
        basisNutrition: { calories: 101, protein: 10.1 },
      },
    });
  });

  it('applies an explicit nullable macro clear after scaling', async () => {
    const { foodLogId } = await createSnapshotLog();

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        serving: { quantity: 200, unit: 'g' },
        nutritionOverride: { mode: 'complex', carbs: null },
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 202,
      protein: 20.2,
      carbs: null,
      servingSnapshot: {
        nutritionOverride: {
          carbs: { applied: true, value: null },
          calories: { applied: false, value: null },
        },
      },
    });
  });

  it('rejects clearing and replacing an override in one request', async () => {
    const { foodLogId } = await createSnapshotLog({
      request: { nutritionOverride: { mode: 'complex', calories: 300 } },
    });
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({
        clearNutritionOverride: true,
        nutritionOverride: { mode: 'complex', calories: 301 },
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'SERVING_UPDATE_CONFLICT');
    await expectUnchanged(foodLogId, before);
  });

  it('adds an override without changing serving by recalculating the snapshot request', async () => {
    const { foodLogId } = await createSnapshotLog({
      request: { serving: { quantity: 50, unit: 'g' } },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ nutritionOverride: { mode: 'complex', calories: 400 } })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 400,
      protein: 5.1,
      servingQuantity: 50,
      servingUnit: 'g',
      servingSnapshot: {
        requestedServing: { quantity: 50, unit: 'g' },
        nutritionOverride: {
          calories: { applied: true, value: 400 },
        },
      },
    });
  });

  it('clears an override without a serving change using the stored requested serving', async () => {
    const { foodLogId } = await createSnapshotLog({
      request: {
        serving: { quantity: 50, unit: 'g' },
        nutritionOverride: { mode: 'complex', calories: 400 },
      },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ clearNutritionOverride: true })
      .expect(200);

    expect(response.body.data).toMatchObject({
      calories: 51,
      protein: 5.1,
      servingSnapshot: {
        requestedServing: { quantity: 50, unit: 'g' },
        nutritionOverride: null,
      },
    });
  });

  it('rejects a meaningless clear when no override exists', async () => {
    const { foodLogId } = await createSnapshotLog();
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ clearNutritionOverride: true })
      .expect(400);

    expectErrorEnvelope(response.body, 'SERVING_UPDATE_CONFLICT');
    await expectUnchanged(foodLogId, before);
  });

  it.each([
    [
      'a raw calorie total',
      { serving: { quantity: 200, unit: 'g' }, calories: 999 },
    ],
    [
      'a raw macro total',
      { serving: { quantity: 200, unit: 'g' }, protein: 99.9 },
    ],
    [
      'raw normalized nutrient totals',
      {
        serving: { quantity: 200, unit: 'g' },
        nutrients: { potassium: { amount: 999, unit: 'mg' } },
      },
    ],
  ])('rejects a serving update with %s', async (_label, body) => {
    const { foodLogId } = await createSnapshotLog();
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send(body)
      .expect(400);

    expectErrorEnvelope(response.body, 'SERVING_UPDATE_CONFLICT');
    await expectUnchanged(foodLogId, before);
  });

  it('rejects raw nutrient edits for a snapshot-backed log without an override', async () => {
    const { foodLogId } = await createSnapshotLog();
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ calories: 999 })
      .expect(409);

    expectErrorEnvelope(
      response.body,
      'SNAPSHOT_NUTRITION_EDIT_REQUIRES_OVERRIDE',
    );
    await expectUnchanged(foodLogId, before);
  });

  it('rejects legacy serving columns for a snapshot-backed log', async () => {
    const { foodLogId } = await createSnapshotLog();
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ servingQuantity: 200, servingUnit: 'g' })
      .expect(400);

    expectErrorEnvelope(response.body, 'SERVING_UPDATE_CONFLICT');
    await expectUnchanged(foodLogId, before);
  });

  it('preserves nutrition and the exact snapshot for metadata-only updates', async () => {
    const { foodLogId } = await createSnapshotLog();
    const before = await readLog(foodLogId);

    const response = await api
      .put(`/api/v1/food-logs/${foodLogId}`)
      .send({ foodName: 'Renamed historical serving', notes: 'metadata only' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      foodName: 'Renamed historical serving',
      notes: 'metadata only',
      calories: before.calories,
      protein: before.protein,
      nutrients: before.nutrients,
      servingSnapshot: before.servingSnapshot,
    });
  });

  it('keeps legacy null-snapshot metadata and nutrient editing behavior', async () => {
    const created = await api
      .post('/api/v1/food-logs')
      .send({
        foodName: 'Legacy raw log',
        mealType: 'lunch',
        calories: 500,
        protein: 40,
        loggedAt,
        nutrients: { potassium: { amount: 100, unit: 'mg' } },
      })
      .expect(200);
    const id = created.body.data.id as string;

    const metadata = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({
        foodName: 'Legacy renamed',
        mealType: 'lunch',
        calories: 500,
        protein: 40,
        loggedAt,
      })
      .expect(200);
    expect(metadata.body.data).toMatchObject({
      foodName: 'Legacy renamed',
      calories: 500,
      nutrients: { potassium: { amount: 100, unit: 'mg' } },
      servingSnapshot: null,
    });

    const nutrients = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({
        foodName: 'Legacy renamed',
        mealType: 'lunch',
        calories: 510,
        protein: 40,
        loggedAt,
        nutrients: { vitaminC: { amount: 20, unit: 'mg' } },
      })
      .expect(200);
    expect(nutrients.body.data).toMatchObject({
      calories: 510,
      nutrients: { vitaminC: { amount: 20, unit: 'mg' } },
      servingSnapshot: null,
    });
  });

  it('rejects a serving request on a legacy null-snapshot log without changing it', async () => {
    const created = await api
      .post('/api/v1/food-logs')
      .send({
        foodName: 'Legacy raw log',
        mealType: 'lunch',
        calories: 500,
        protein: 40,
        loggedAt,
      })
      .expect(200);
    const id = created.body.data.id as string;
    const before = await readLog(id);

    const response = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({ serving: { quantity: 200, unit: 'g' } })
      .expect(422);

    expectErrorEnvelope(response.body, 'SERVING_UPDATE_UNAVAILABLE');
    await expectUnchanged(id, before);
  });

  it('returns a safe internal error for a malformed stored snapshot without modifying it', async () => {
    const foodLog = await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodName: 'Malformed snapshot',
        mealType: 'lunch',
        calories: 500,
        protein: 40,
        loggedAt: new Date(loggedAt),
        servingSnapshot: { schemaVersion: 99 } as Prisma.InputJsonValue,
        nutrients: {
          create: { nutrientKey: 'potassium', amount: 100, unit: 'mg' },
        },
      },
    });
    const storedBefore = await prisma.foodLog.findUnique({
      where: { id: foodLog.id },
      include: { nutrients: true },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLog.id}`)
      .send({ foodName: 'Should not persist' })
      .expect(500);

    expectErrorEnvelope(response.body, 'INTERNAL_SERVER_ERROR');
    expect(response.body.error.details).toEqual({});
    const storedAfter = await prisma.foodLog.findUnique({
      where: { id: foodLog.id },
      include: { nutrients: true },
    });
    expect(storedAfter).toEqual(storedBefore);
  });

  it('preserves ownership behavior for update attempts', async () => {
    await ensureOtherUser();
    const foodLog = await prisma.foodLog.create({
      data: {
        userId: OTHER_USER_ID,
        foodName: 'Other user log',
        mealType: 'lunch',
        calories: 500,
        protein: 40,
        loggedAt: new Date(loggedAt),
      },
    });

    const response = await api
      .put(`/api/v1/food-logs/${foodLog.id}`)
      .send({ foodName: 'Not allowed' })
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
    expect(
      (await prisma.foodLog.findUnique({ where: { id: foodLog.id } }))
        ?.foodName,
    ).toBe('Other user log');
  });
});
