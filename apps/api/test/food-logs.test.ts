import { MOCK_USER_ID } from '@food-tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { localDateTime } from './helpers/dates.js';
import { seedFoodItem, seedFoodLog, seedProfile } from './helpers/seeds.js';

const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';
const MISSING_FOOD_LOG_ID = '00000000-0000-4000-8000-000000000099';

const validFoodLog = {
  foodName: 'Chicken wrap',
  mealType: 'lunch',
  calories: 650,
  protein: 42.5,
  carbs: 55.2,
  fat: 18.4,
  loggedAt: '2026-06-15T17:00:00.000Z',
};

const validFoodLogWithNutrients = {
  ...validFoodLog,
  nutrients: {
    caffeine: { amount: 95, unit: 'mg' },
    vitaminC: { amount: 60, unit: 'mg' },
    leucine: { amount: 1.2, unit: 'g' },
  },
};

describe('food logs API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.USDA_FDC_API_KEY;
  });

  it('creates and persists a valid food log', async () => {
    const response = await api
      .post('/api/v1/food-logs')
      .send(validFoodLog)
      .expect(200);
    const persisted = await prisma.foodLog.findUnique({
      where: { id: response.body.data.id as string },
    });

    expect(response.body).toMatchObject({
      success: true,
      data: {
        foodName: 'Chicken wrap',
        mealType: 'lunch',
        calories: 650,
        protein: 42.5,
      },
    });
    expect(persisted?.userId).toBe(MOCK_USER_ID);
    expect(persisted?.calories).toBe(650);
  });

  it('creates a manual food log linked to a visible food item', async () => {
    const foodItem = await seedFoodItem({ name: 'Reusable wrap' });

    const response = await api
      .post('/api/v1/food-logs')
      .send({ ...validFoodLog, foodItemId: foodItem.id })
      .expect(200);

    expect(response.body.data).toMatchObject({
      foodItemId: foodItem.id,
      foodName: 'Chicken wrap',
    });
    expect(
      (
        await prisma.foodLog.findUnique({
          where: { id: response.body.data.id as string },
        })
      )?.foodItemId,
    ).toBe(foodItem.id);
  });

  it('rejects manual food log links to inaccessible food items', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const otherFood = await seedFoodItem({
      userId: OTHER_USER_ID,
      name: 'Private reusable food',
    });
    const archivedFood = await seedFoodItem({
      name: 'Archived reusable food',
      archivedAt: new Date(),
    });

    for (const foodItemId of [otherFood.id, archivedFood.id]) {
      const response = await api
        .post('/api/v1/food-logs')
        .send({ ...validFoodLog, foodItemId })
        .expect(404);

      expectErrorEnvelope(response.body, 'NOT_FOUND');
    }
  });

  it('creates and returns extended nutrient snapshots when provided', async () => {
    const response = await api
      .post('/api/v1/food-logs')
      .send(validFoodLogWithNutrients)
      .expect(200);

    expect(response.body.data.nutrients).toEqual({
      caffeine: { amount: 95, unit: 'mg' },
      leucine: { amount: 1.2, unit: 'g' },
      vitaminC: { amount: 60, unit: 'mg' },
    });
    expect(
      await prisma.foodLogNutrient.count({
        where: { foodLogId: response.body.data.id as string },
      }),
    ).toBe(3);
  });

  it('preserves, replaces, and clears food log nutrient snapshots on update', async () => {
    const created = await api
      .post('/api/v1/food-logs')
      .send(validFoodLogWithNutrients)
      .expect(200);
    const id = created.body.data.id as string;

    const preserved = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({ ...validFoodLog, foodName: 'Snapshot renamed' })
      .expect(200);

    expect(preserved.body.data.nutrients).toEqual(created.body.data.nutrients);

    const replaced = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({
        ...validFoodLog,
        nutrients: { potassium: { amount: 300, unit: 'mg' } },
      })
      .expect(200);

    expect(replaced.body.data.nutrients).toEqual({
      potassium: { amount: 300, unit: 'mg' },
    });

    const cleared = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({ ...validFoodLog, nutrients: null })
      .expect(200);

    expect(cleared.body.data.nutrients).toEqual({});
    expect(
      await prisma.foodLogNutrient.count({ where: { foodLogId: id } }),
    ).toBe(0);
  });

  it('keeps log nutrient snapshots when a related food item changes or is archived', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Snapshot source',
        normalizedName: 'snapshot source',
        searchText: 'snapshot source',
        sourceType: 'user_custom',
        foodType: 'generic',
        nutrients: {
          create: {
            nutrientKey: 'caffeine',
            amount: 95,
            unit: 'mg',
          },
        },
      },
    });
    const foodLog = await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodItemId: foodItem.id,
        foodName: 'Snapshot log',
        mealType: 'breakfast',
        calories: 100,
        protein: 10,
        loggedAt: new Date(validFoodLog.loggedAt),
        nutrients: {
          create: {
            nutrientKey: 'caffeine',
            amount: 80,
            unit: 'mg',
          },
        },
      },
      include: { nutrients: true },
    });

    await prisma.foodItem.update({
      where: { id: foodItem.id },
      data: {
        archivedAt: new Date(),
        nutrients: {
          deleteMany: {},
          create: {
            nutrientKey: 'caffeine',
            amount: 120,
            unit: 'mg',
          },
        },
      },
    });

    const response = await api
      .get(`/api/v1/food-logs/${foodLog.id}`)
      .expect(200);

    expect(foodLog.nutrients[0]?.amount.toNumber()).toBe(80);
    expect(response.body.data.nutrients).toEqual({
      caffeine: { amount: 80, unit: 'mg' },
    });
  });

  it('returns created food logs', async () => {
    const created = await api
      .post('/api/v1/food-logs')
      .send(validFoodLog)
      .expect(200);

    const response = await api.get('/api/v1/food-logs').expect(200);

    expect(response.body.data.foodLogs).toHaveLength(1);
    expect(response.body.data.foodLogs[0].id).toBe(created.body.data.id);
  });

  it('returns a current-user food log by id', async () => {
    const foodLog = await seedFoodLog({ foodName: 'Fetched meal' });

    const response = await api
      .get(`/api/v1/food-logs/${foodLog.id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: foodLog.id,
        foodName: 'Fetched meal',
      },
    });
  });

  it('returns not found for a missing food log', async () => {
    const response = await api
      .get(`/api/v1/food-logs/${MISSING_FOOD_LOG_ID}`)
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });

  it('does not return another user’s food log by id', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const foodLog = await prisma.foodLog.create({
      data: {
        userId: OTHER_USER_ID,
        foodName: 'Private meal',
        mealType: 'dinner',
        calories: 500,
        protein: 35,
        loggedAt: new Date(validFoodLog.loggedAt),
      },
    });

    const response = await api
      .get(`/api/v1/food-logs/${foodLog.id}`)
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });

  it('updates a food log', async () => {
    const created = await api
      .post('/api/v1/food-logs')
      .send(validFoodLog)
      .expect(200);
    const updatedInput = {
      ...validFoodLog,
      foodName: 'Updated wrap',
      calories: 700,
      protein: 50,
    };

    const response = await api
      .put(`/api/v1/food-logs/${created.body.data.id as string}`)
      .send(updatedInput)
      .expect(200);

    expect(response.body.data).toMatchObject({
      foodName: 'Updated wrap',
      calories: 700,
      protein: 50,
    });
    expect(
      (
        await prisma.foodLog.findUnique({
          where: { id: created.body.data.id as string },
        })
      )?.calories,
    ).toBe(700);
  });

  it('preserves and clears a food log food item relation on update', async () => {
    const foodItem = await seedFoodItem({ name: 'Preserved source' });
    const created = await api
      .post('/api/v1/food-logs')
      .send({ ...validFoodLog, foodItemId: foodItem.id })
      .expect(200);
    const id = created.body.data.id as string;

    const preserved = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({ ...validFoodLog, foodName: 'Preserved relation' })
      .expect(200);

    expect(preserved.body.data.foodItemId).toBe(foodItem.id);

    const cleared = await api
      .put(`/api/v1/food-logs/${id}`)
      .send({ ...validFoodLog, foodItemId: null })
      .expect(200);

    expect(cleared.body.data.foodItemId).toBeNull();
    expect(
      (await prisma.foodLog.findUnique({ where: { id } }))?.foodItemId,
    ).toBeNull();
  });

  it('logs from a food item with scaled snapshot nutrients', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Greek yogurt',
        brandName: 'Plain Dairy',
        normalizedName: 'greek yogurt',
        normalizedBrandName: 'plain dairy',
        searchText: 'greek yogurt plain dairy',
        sourceType: 'user_custom',
        foodType: 'branded',
        servingQuantity: 1,
        servingUnit: 'cup',
        calories: 130,
        protein: 22.4,
        carbs: 8.2,
        fat: 3.6,
        fiber: null,
        sugar: 6.4,
        sodium: 55,
        nutrients: {
          create: [
            { nutrientKey: 'caffeine', amount: 95, unit: 'mg' },
            { nutrientKey: 'vitaminC', amount: 60, unit: 'mg' },
          ],
        },
      },
    });

    const response = await api
      .post('/api/v1/food-logs/from-food-item')
      .send({
        foodItemId: foodItem.id,
        mealType: 'breakfast',
        loggedAt: validFoodLog.loggedAt,
        servingMultiplier: 1.5,
        notes: 'With berries',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      foodItemId: foodItem.id,
      foodName: 'Greek yogurt',
      mealType: 'breakfast',
      calories: 195,
      protein: 33.6,
      carbs: 12.3,
      fat: 5.4,
      fiber: null,
      sugar: 9.6,
      sodium: 83,
      servingQuantity: 1.5,
      servingUnit: 'cup',
      notes: 'With berries',
      nutrients: {
        caffeine: { amount: 142.5, unit: 'mg' },
        vitaminC: { amount: 90, unit: 'mg' },
      },
    });

    expect(
      await prisma.foodLogNutrient.count({
        where: { foodLogId: response.body.data.id as string },
      }),
    ).toBe(2);
  });

  it('keeps log-from-food snapshots when the food item changes later', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Snapshot yogurt',
        normalizedName: 'snapshot yogurt',
        searchText: 'snapshot yogurt',
        sourceType: 'user_custom',
        foodType: 'generic',
        calories: 100,
        protein: 10,
        nutrients: {
          create: { nutrientKey: 'caffeine', amount: 80, unit: 'mg' },
        },
      },
    });

    const created = await api
      .post('/api/v1/food-logs/from-food-item')
      .send({
        foodItemId: foodItem.id,
        mealType: 'snack',
        loggedAt: validFoodLog.loggedAt,
      })
      .expect(200);

    await prisma.foodItem.update({
      where: { id: foodItem.id },
      data: {
        calories: 200,
        protein: 20,
        nutrients: {
          deleteMany: {},
          create: { nutrientKey: 'caffeine', amount: 120, unit: 'mg' },
        },
      },
    });

    const fetched = await api
      .get(`/api/v1/food-logs/${created.body.data.id as string}`)
      .expect(200);

    expect(fetched.body.data).toMatchObject({
      calories: 100,
      protein: 10,
      nutrients: { caffeine: { amount: 80, unit: 'mg' } },
    });
  });

  it('logs selected food items transactionally with scaled snapshot nutrients', async () => {
    const yogurt = await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Greek yogurt',
        normalizedName: 'greek yogurt',
        searchText: 'greek yogurt',
        sourceType: 'user_custom',
        foodType: 'generic',
        servingQuantity: 1,
        servingUnit: 'cup',
        calories: 130,
        protein: 22.4,
        nutrients: {
          create: { nutrientKey: 'vitaminC', amount: 60, unit: 'mg' },
        },
      },
    });
    const banana = await prisma.foodItem.create({
      data: {
        userId: null,
        name: 'Banana',
        normalizedName: 'banana',
        searchText: 'banana',
        sourceType: 'app_owned',
        foodType: 'generic',
        servingQuantity: 1,
        servingUnit: 'medium',
        calories: 105,
        protein: 1.3,
      },
    });

    const response = await api
      .post('/api/v1/food-logs/from-food-items')
      .send({
        mealType: 'breakfast',
        loggedAt: validFoodLog.loggedAt,
        items: [
          { foodItemId: yogurt.id, servingMultiplier: 1.5 },
          { foodItemId: banana.id, servingMultiplier: 2 },
        ],
      })
      .expect(200);

    expect(response.body.data.foodLogs).toHaveLength(2);
    expect(response.body.data.foodLogs).toEqual([
      expect.objectContaining({
        foodItemId: yogurt.id,
        foodName: 'Greek yogurt',
        calories: 195,
        protein: 33.6,
        nutrients: { vitaminC: { amount: 90, unit: 'mg' } },
      }),
      expect.objectContaining({
        foodItemId: banana.id,
        foodName: 'Banana',
        calories: 210,
        protein: 2.6,
        nutrients: {},
      }),
    ]);
    expect(await prisma.foodLog.count()).toBe(2);
  });

  it('rejects unloggable selected food items without partially saving', async () => {
    const loggable = await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Loggable eggs',
        normalizedName: 'loggable eggs',
        searchText: 'loggable eggs',
        sourceType: 'user_custom',
        foodType: 'generic',
        calories: 140,
        protein: 12,
      },
    });
    const unloggable = await seedFoodItem({
      name: 'Unknown protein food',
      normalizedName: 'unknown protein food',
      searchText: 'unknown protein food',
    });

    const response = await api
      .post('/api/v1/food-logs/from-food-items')
      .send({
        mealType: 'breakfast',
        loggedAt: validFoodLog.loggedAt,
        items: [
          { foodItemId: loggable.id, servingMultiplier: 1 },
          { foodItemId: unloggable.id, servingMultiplier: 1 },
        ],
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('logs selected USDA candidates by refetching, caching, and snapshotting trusted nutrients', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            fdcId: 173944,
            description: 'Bananas, raw',
            dataType: 'Foundation',
            publicationDate: '2019-04-01',
            foodNutrients: [
              { amount: 89, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 1.09, nutrient: { name: 'Protein', unitName: 'G' } },
              {
                amount: 22.84,
                nutrient: {
                  name: 'Carbohydrate, by difference',
                  unitName: 'G',
                },
              },
              {
                amount: 0.33,
                nutrient: { name: 'Total lipid (fat)', unitName: 'G' },
              },
              {
                amount: 2.6,
                nutrient: { name: 'Fiber, total dietary', unitName: 'G' },
              },
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

    const response = await api
      .post('/api/v1/food-logs/from-candidates')
      .send({
        mealType: 'breakfast',
        loggedAt: validFoodLog.loggedAt,
        items: [
          {
            candidateType: 'external_food',
            sourceProvider: 'usda_fdc',
            sourceId: '173944',
            servingMultiplier: 2,
          },
        ],
      })
      .expect(200);

    expect(response.body.data.foodLogs).toEqual([
      expect.objectContaining({
        foodName: 'Bananas, raw',
        calories: 178,
        protein: 2.2,
        carbs: 45.6,
        fat: 0.6,
        fiber: 5.2,
        servingQuantity: 200,
        servingUnit: 'g',
        nutrients: {
          potassium: { amount: 716, unit: 'mg' },
        },
      }),
    ]);

    const cachedFood = await prisma.foodItem.findFirst({
      where: {
        sourceProvider: 'usda_fdc',
        sourceId: '173944',
      },
      include: { nutrients: true },
    });
    expect(cachedFood).toMatchObject({
      userId: null,
      name: 'Bananas, raw',
      sourceType: 'cached_external',
      foodType: 'generic',
      servingQuantity: expect.objectContaining({}),
      servingUnit: 'g',
      calories: 89,
    });
    expect(cachedFood?.servingQuantity?.toNumber()).toBe(100);
    expect(cachedFood?.nutrients).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('applies explicit simple log-level nutrition overrides without mutating trusted food items', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: null,
        name: 'Trusted salmon',
        normalizedName: 'trusted salmon',
        searchText: 'trusted salmon',
        sourceType: 'app_owned',
        foodType: 'generic',
        calories: 200,
        protein: 22,
        carbs: 0,
        fat: 12,
      },
    });

    const response = await api
      .post('/api/v1/food-logs/from-candidates')
      .send({
        mealType: 'dinner',
        loggedAt: validFoodLog.loggedAt,
        items: [
          {
            candidateType: 'food_item',
            foodItemId: foodItem.id,
            servingMultiplier: 1,
            nutritionOverride: {
              mode: 'simple',
              calories: 240,
              protein: 30.2,
              fat: 14.4,
              sodium: 80,
            },
          },
        ],
      })
      .expect(200);

    expect(response.body.data.foodLogs[0]).toMatchObject({
      foodItemId: foodItem.id,
      calories: 240,
      protein: 30.2,
      carbs: 0,
      fat: 14.4,
      sodium: 80,
    });
    expect(
      (await prisma.foodItem.findUnique({ where: { id: foodItem.id } }))
        ?.calories,
    ).toBe(200);
  });

  it('rejects normalized nutrient overrides in simple mode', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: null,
        name: 'Trusted banana',
        normalizedName: 'trusted banana',
        searchText: 'trusted banana',
        sourceType: 'app_owned',
        foodType: 'generic',
        calories: 105,
        protein: 1.3,
      },
    });

    const response = await api
      .post('/api/v1/food-logs/from-candidates')
      .send({
        mealType: 'snack',
        loggedAt: validFoodLog.loggedAt,
        items: [
          {
            candidateType: 'food_item',
            foodItemId: foodItem.id,
            nutritionOverride: {
              mode: 'simple',
              nutrients: { potassium: { amount: 400, unit: 'mg' } },
            },
          },
        ],
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('accepts supported normalized nutrient overrides in complex mode', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: null,
        name: 'Trusted coffee',
        normalizedName: 'trusted coffee',
        searchText: 'trusted coffee',
        sourceType: 'app_owned',
        foodType: 'generic',
        calories: 5,
        protein: 0,
      },
    });

    const response = await api
      .post('/api/v1/food-logs/from-candidates')
      .send({
        mealType: 'snack',
        loggedAt: validFoodLog.loggedAt,
        items: [
          {
            candidateType: 'food_item',
            foodItemId: foodItem.id,
            nutritionOverride: {
              mode: 'complex',
              nutrients: { caffeine: { amount: 95, unit: 'mg' } },
            },
          },
        ],
      })
      .expect(200);

    expect(response.body.data.foodLogs[0]).toMatchObject({
      nutrients: { caffeine: { amount: 95, unit: 'mg' } },
    });
  });

  it('saves reviewed AI estimates as unlinked food log snapshots only', async () => {
    const response = await api
      .post('/api/v1/food-logs/from-ai-estimate')
      .send({
        source: 'ai_estimate',
        trustLevel: 'low',
        reviewed: true,
        edited: true,
        foodName: 'homemade ghanaian stew with rice',
        mealType: 'dinner',
        calories: 520,
        protein: 18.4,
        carbs: 72.2,
        fat: 16.5,
        fiber: 8.1,
        sugar: null,
        sodium: null,
        servingQuantity: 1,
        servingUnit: 'bowl',
        loggedAt: validFoodLog.loggedAt,
        notes: 'Used fallback after no trusted match.',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      foodItemId: null,
      foodName: 'homemade ghanaian stew with rice',
      mealType: 'dinner',
      calories: 520,
      protein: 18.4,
      carbs: 72.2,
      fat: 16.5,
      fiber: 8.1,
      sugar: null,
      sodium: null,
      servingQuantity: 1,
      servingUnit: 'bowl',
      notes:
        '[AI-estimated nutrition: low trust, adjusted] Used fallback after no trusted match.',
      nutrients: {},
    });
    expect(await prisma.foodLog.count()).toBe(1);
    expect(await prisma.foodItem.count()).toBe(0);
  });

  it('rejects selected USDA candidates without trusted calories and protein without partial saves', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    const localFood = await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Loggable eggs',
        normalizedName: 'loggable eggs',
        searchText: 'loggable eggs',
        sourceType: 'user_custom',
        foodType: 'generic',
        calories: 140,
        protein: 12,
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              fdcId: 999,
              description: 'Mystery food',
              dataType: 'Foundation',
              foodNutrients: [
                { amount: 50, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/food-logs/from-candidates')
      .send({
        mealType: 'breakfast',
        loggedAt: validFoodLog.loggedAt,
        items: [
          {
            candidateType: 'food_item',
            foodItemId: localFood.id,
            servingMultiplier: 1,
          },
          {
            candidateType: 'external_food',
            sourceProvider: 'usda_fdc',
            sourceId: '999',
            servingMultiplier: 1,
          },
        ],
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
    expect(await prisma.foodLog.count()).toBe(0);
    expect(await prisma.foodItem.count({ where: { sourceId: '999' } })).toBe(0);
  });

  it('rejects log-from-food when required food log nutrients are unknown', async () => {
    const foodItem = await seedFoodItem({
      name: 'Unknown protein food',
      normalizedName: 'unknown protein food',
      searchText: 'unknown protein food',
    });

    const response = await api
      .post('/api/v1/food-logs/from-food-item')
      .send({
        foodItemId: foodItem.id,
        mealType: 'snack',
        loggedAt: validFoodLog.loggedAt,
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('deletes a food log', async () => {
    const foodLog = await seedFoodLog();

    const response = await api
      .delete(`/api/v1/food-logs/${foodLog.id}`)
      .expect(200);

    expect(response.body.data).toEqual({ id: foodLog.id, deleted: true });
    expect(
      await prisma.foodLog.findUnique({ where: { id: foodLog.id } }),
    ).toBeNull();
  });

  it.each([
    ['invalid meal type', { ...validFoodLog, mealType: 'brunch' }],
    ['negative calories', { ...validFoodLog, calories: -1 }],
    [
      'invalid nutrient key',
      { ...validFoodLog, nutrients: { mystery: { amount: 1, unit: 'mg' } } },
    ],
    [
      'column-backed nutrient as normalized input',
      { ...validFoodLog, nutrients: { protein: { amount: 42.5, unit: 'g' } } },
    ],
    [
      'invalid nutrient unit',
      { ...validFoodLog, nutrients: { caffeine: { amount: 95, unit: 'g' } } },
    ],
    [
      'negative nutrient amount',
      { ...validFoodLog, nutrients: { caffeine: { amount: -1, unit: 'mg' } } },
    ],
    ['invalid datetime', { ...validFoodLog, loggedAt: 'yesterday' }],
  ])('rejects %s', async (_label, input) => {
    const response = await api
      .post('/api/v1/food-logs')
      .send(input)
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('filters food logs by local date', async () => {
    await seedProfile();
    await seedFoodLog({
      foodName: 'Local June 14',
      loggedAt: new Date(localDateTime('2026-06-14', 23.5)),
    });
    await seedFoodLog({
      foodName: 'Local June 15',
      loggedAt: new Date(localDateTime('2026-06-15', 0.5)),
    });

    const response = await api
      .get('/api/v1/food-logs')
      .query({ date: '2026-06-15' })
      .expect(200);

    expect(response.body.data.foodLogs).toHaveLength(1);
    expect(response.body.data.foodLogs[0].foodName).toBe('Local June 15');
  });

  it('filters food logs by meal type', async () => {
    await seedFoodLog({ foodName: 'Breakfast', mealType: 'breakfast' });
    await seedFoodLog({ foodName: 'Dinner', mealType: 'dinner' });

    const response = await api
      .get('/api/v1/food-logs')
      .query({ mealType: 'dinner' })
      .expect(200);

    expect(response.body.data.foodLogs).toHaveLength(1);
    expect(response.body.data.foodLogs[0].foodName).toBe('Dinner');
  });

  it('limits recent food logs in newest-first order', async () => {
    await seedFoodLog({
      foodName: 'Oldest',
      loggedAt: new Date('2026-06-13T12:00:00.000Z'),
    });
    await seedFoodLog({
      foodName: 'Middle',
      loggedAt: new Date('2026-06-14T12:00:00.000Z'),
    });
    await seedFoodLog({
      foodName: 'Newest',
      loggedAt: new Date('2026-06-15T12:00:00.000Z'),
    });

    const response = await api
      .get('/api/v1/food-logs')
      .query({ limit: 2 })
      .expect(200);

    expect(response.body.data.foodLogs).toHaveLength(2);
    expect(
      response.body.data.foodLogs.map(
        (foodLog: { foodName: string }) => foodLog.foodName,
      ),
    ).toEqual(['Newest', 'Middle']);
  });

  it.each([0, 51])('rejects food log limit %s', async (limit) => {
    const response = await api
      .get('/api/v1/food-logs')
      .query({ limit })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('rejects conflicting date filters', async () => {
    const response = await api
      .get('/api/v1/food-logs')
      .query({ date: '2026-06-15', startDate: '2026-06-14' })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });
});
