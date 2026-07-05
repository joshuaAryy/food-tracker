import {
  COLUMN_BACKED_NUTRIENT_KEYS,
  MOCK_USER_ID,
  NORMALIZED_NUTRIENT_KEYS,
  NUTRIENT_CATALOG,
} from '@food-tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  api,
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './helpers/api.js';

const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';
const MISSING_FOOD_ITEM_ID = '00000000-0000-4000-8000-000000000099';

const customFoodInput = {
  name: 'Greek yogurt',
  brandName: 'Plain Dairy',
  foodType: 'branded',
  servingQuantity: 1,
  servingUnit: 'cup',
  servingWeightGrams: 245,
  calories: 130,
  protein: 22.4,
  carbs: null,
  fat: null,
  fiber: null,
  sugar: null,
  sodium: null,
  additionalNutrients: {
    caffeine: { amount: 0, unit: 'mg' },
  },
};

const customFoodWithNutrientsInput = {
  ...customFoodInput,
  nutrients: {
    caffeine: { amount: 95, unit: 'mg' },
    vitaminC: { amount: 60, unit: 'mg' },
    vitaminD: { amount: 20, unit: 'mcg' },
    addedSugar: { amount: 4.5, unit: 'g' },
    leucine: { amount: 1.2, unit: 'g' },
    calcium: { amount: 250, unit: 'mg' },
  },
};

interface FoodItemResponseBody {
  id: string;
  name: string;
  nutrients?: unknown;
}

interface FoodItemsListResponseBody {
  foodItems: FoodItemResponseBody[];
}

describe('food items API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes a future-ready static nutrient catalog without duplicating column-backed nutrients as normalized rows', () => {
    expect(COLUMN_BACKED_NUTRIENT_KEYS).toEqual([
      'calories',
      'protein',
      'carbs',
      'fat',
      'fiber',
      'sugar',
      'sodium',
    ]);
    expect(NORMALIZED_NUTRIENT_KEYS).toEqual(
      expect.arrayContaining([
        'addedSugar',
        'starch',
        'solubleFiber',
        'insolubleFiber',
        'sugarAlcohol',
        'saturatedFat',
        'transFat',
        'monounsaturatedFat',
        'polyunsaturatedFat',
        'omega3',
        'omega6',
        'cholesterol',
        'histidine',
        'isoleucine',
        'leucine',
        'lysine',
        'methionine',
        'phenylalanine',
        'threonine',
        'tryptophan',
        'valine',
        'alanine',
        'arginine',
        'asparticAcid',
        'cystine',
        'glutamicAcid',
        'glycine',
        'proline',
        'serine',
        'tyrosine',
        'potassium',
        'caffeine',
        'alcohol',
        'water',
        'oxalate',
        'phytate',
        'vitaminA',
        'thiamine',
        'riboflavin',
        'niacin',
        'pantothenicAcid',
        'vitaminB6',
        'biotin',
        'folate',
        'vitaminB12',
        'vitaminC',
        'vitaminD',
        'vitaminE',
        'vitaminK',
        'calcium',
        'iron',
        'magnesium',
        'zinc',
        'phosphorus',
        'selenium',
        'copper',
        'manganese',
        'iodine',
        'chromium',
        'molybdenum',
        'chloride',
      ]),
    );
    expect(NUTRIENT_CATALOG.caffeine).toMatchObject({
      category: 'stimulant',
      defaultUnit: 'mg',
      storage: 'normalized',
    });
    expect(NUTRIENT_CATALOG.vitaminD).toMatchObject({
      category: 'vitamin',
      defaultUnit: 'mcg',
      storage: 'normalized',
    });
    expect(NUTRIENT_CATALOG.protein.storage).toBe('column');
  });

  it('creates a current-user custom food with nullable nutrition fields', async () => {
    const response = await api
      .post('/api/v1/food-items')
      .send(customFoodInput)
      .expect(200);

    expectSuccessEnvelope(response.body);
    expect(response.body.data).toMatchObject({
      name: 'Greek yogurt',
      brandName: 'Plain Dairy',
      sourceType: 'user_custom',
      foodType: 'branded',
      isSaved: false,
      calories: 130,
      protein: 22.4,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
    });

    const data = response.body.data as FoodItemResponseBody;
    const persisted = await prisma.foodItem.findUnique({
      where: { id: data.id },
    });
    expect(persisted?.userId).toBe(MOCK_USER_ID);
    expect(persisted?.carbs).toBeNull();
    expect(persisted?.sodium).toBeNull();
  });

  it('creates and returns normalized extended nutrients for custom foods', async () => {
    const response = await api
      .post('/api/v1/food-items')
      .send(customFoodWithNutrientsInput)
      .expect(200);

    expectSuccessEnvelope(response.body);
    const data = response.body.data as FoodItemResponseBody;
    expect(data.nutrients).toEqual({
      addedSugar: { amount: 4.5, unit: 'g' },
      caffeine: { amount: 95, unit: 'mg' },
      calcium: { amount: 250, unit: 'mg' },
      leucine: { amount: 1.2, unit: 'g' },
      vitaminC: { amount: 60, unit: 'mg' },
      vitaminD: { amount: 20, unit: 'mcg' },
    });

    expect(await prisma.foodItemNutrient.count()).toBe(6);
  });

  it('preserves, replaces, and clears normalized food item nutrients on update', async () => {
    const created = await api
      .post('/api/v1/food-items')
      .send(customFoodWithNutrientsInput)
      .expect(200);
    const id = created.body.data.id as string;

    const preserved = await api
      .put(`/api/v1/food-items/${id}`)
      .send({ ...customFoodInput, name: 'Renamed yogurt' })
      .expect(200);

    expect(preserved.body.data.nutrients).toEqual(created.body.data.nutrients);

    const replaced = await api
      .put(`/api/v1/food-items/${id}`)
      .send({
        ...customFoodInput,
        nutrients: { potassium: { amount: 300, unit: 'mg' } },
      })
      .expect(200);

    expect(replaced.body.data.nutrients).toEqual({
      potassium: { amount: 300, unit: 'mg' },
    });
    expect(
      await prisma.foodItemNutrient.count({ where: { foodItemId: id } }),
    ).toBe(1);

    const cleared = await api
      .put(`/api/v1/food-items/${id}`)
      .send({ ...customFoodInput, nutrients: null })
      .expect(200);

    expect(cleared.body.data.nutrients).toEqual({});
    expect(
      await prisma.foodItemNutrient.count({ where: { foodItemId: id } }),
    ).toBe(0);
  });

  it('keeps omitted nutrition fields unknown instead of converting them to zero', async () => {
    const response = await api
      .post('/api/v1/food-items')
      .send({ name: 'Black coffee', foodType: 'generic' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      name: 'Black coffee',
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
    });
  });

  it.each([
    ['unknown fields', { ...customFoodInput, userId: OTHER_USER_ID }],
    ['negative nutrient', { ...customFoodInput, protein: -1 }],
    [
      'negative extended nutrient',
      {
        ...customFoodInput,
        nutrients: { caffeine: { amount: -1, unit: 'mg' } },
      },
    ],
    [
      'invalid extended nutrient key',
      {
        ...customFoodInput,
        nutrients: { mystery: { amount: 1, unit: 'mg' } },
      },
    ],
    [
      'column-backed nutrient as normalized input',
      {
        ...customFoodInput,
        nutrients: { protein: { amount: 22.4, unit: 'g' } },
      },
    ],
    [
      'non-default extended nutrient unit',
      {
        ...customFoodInput,
        nutrients: { caffeine: { amount: 0.095, unit: 'g' } },
      },
    ],
    ['invalid serving quantity', { ...customFoodInput, servingQuantity: 0 }],
  ])('rejects %s when creating a food item', async (_label, input) => {
    const response = await api
      .post('/api/v1/food-items')
      .send(input)
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('lists and searches visible non-archived food items only', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    await prisma.foodItem.create({
      data: {
        name: 'Banana',
        normalizedName: 'banana',
        searchText: 'banana',
        sourceType: 'app_owned',
        foodType: 'generic',
      },
    });
    await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Greek yogurt',
        brandName: 'Plain Dairy',
        normalizedName: 'greek yogurt',
        normalizedBrandName: 'plain dairy',
        searchText: 'greek yogurt plain dairy',
        sourceType: 'user_custom',
        foodType: 'branded',
      },
    });
    await prisma.foodItem.create({
      data: {
        userId: OTHER_USER_ID,
        name: 'Private yogurt',
        normalizedName: 'private yogurt',
        searchText: 'private yogurt',
        sourceType: 'user_custom',
        foodType: 'generic',
      },
    });
    await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Archived yogurt',
        normalizedName: 'archived yogurt',
        searchText: 'archived yogurt',
        sourceType: 'user_custom',
        foodType: 'generic',
        archivedAt: new Date(),
      },
    });

    const response = await api
      .get('/api/v1/food-items')
      .query({ query: 'yogurt' })
      .expect(200);

    expectSuccessEnvelope(response.body);
    const data = response.body.data as FoodItemsListResponseBody;
    expect(data.foodItems.map((foodItem) => foodItem.name)).toEqual([
      'Greek yogurt',
    ]);
  });

  it('does not expose another user custom food through get, update, archive, or save', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const otherFood = await prisma.foodItem.create({
      data: {
        userId: OTHER_USER_ID,
        name: 'Private food',
        normalizedName: 'private food',
        searchText: 'private food',
        sourceType: 'user_custom',
        foodType: 'generic',
      },
    });

    for (const response of [
      await api.get(`/api/v1/food-items/${otherFood.id}`).expect(404),
      await api
        .put(`/api/v1/food-items/${otherFood.id}`)
        .send(customFoodInput)
        .expect(404),
      await api.delete(`/api/v1/food-items/${otherFood.id}`).expect(404),
      await api.post(`/api/v1/food-items/${otherFood.id}/save`).expect(404),
    ]) {
      expectErrorEnvelope(response.body, 'NOT_FOUND');
    }
  });

  it('updates and archives only current-user custom foods', async () => {
    const created = await api
      .post('/api/v1/food-items')
      .send(customFoodInput)
      .expect(200);
    const id = created.body.data.id as string;

    const updated = await api
      .put(`/api/v1/food-items/${id}`)
      .send({ ...customFoodInput, name: 'Updated yogurt', calories: 140 })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      id,
      name: 'Updated yogurt',
      calories: 140,
    });

    const deleted = await api.delete(`/api/v1/food-items/${id}`).expect(200);
    expect(deleted.body.data).toEqual({ id, archived: true });

    const getArchived = await api.get(`/api/v1/food-items/${id}`).expect(404);
    expectErrorEnvelope(getArchived.body, 'NOT_FOUND');

    const listed = await api.get('/api/v1/food-items').expect(200);
    expect(listed.body.data.foodItems).toEqual([]);
  });

  it('prevents editing or archiving globally visible foods', async () => {
    const globalFood = await prisma.foodItem.create({
      data: {
        name: 'Apple',
        normalizedName: 'apple',
        searchText: 'apple',
        sourceType: 'app_owned',
        foodType: 'generic',
      },
    });

    const updateResponse = await api
      .put(`/api/v1/food-items/${globalFood.id}`)
      .send(customFoodInput)
      .expect(404);
    const deleteResponse = await api
      .delete(`/api/v1/food-items/${globalFood.id}`)
      .expect(404);

    expectErrorEnvelope(updateResponse.body, 'NOT_FOUND');
    expectErrorEnvelope(deleteResponse.body, 'NOT_FOUND');
  });

  it('saves and unsaves a visible food item idempotently', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        name: 'Banana',
        normalizedName: 'banana',
        searchText: 'banana',
        sourceType: 'app_owned',
        foodType: 'generic',
      },
    });

    const firstSave = await api
      .post(`/api/v1/food-items/${foodItem.id}/save`)
      .expect(200);
    const secondSave = await api
      .post(`/api/v1/food-items/${foodItem.id}/save`)
      .expect(200);

    expect(firstSave.body.data).toEqual({ id: foodItem.id, saved: true });
    expect(secondSave.body.data).toEqual({ id: foodItem.id, saved: true });
    expect(await prisma.savedFoodItem.count()).toBe(1);

    const firstUnsave = await api
      .delete(`/api/v1/food-items/${foodItem.id}/save`)
      .expect(200);
    const secondUnsave = await api
      .delete(`/api/v1/food-items/${foodItem.id}/save`)
      .expect(200);

    expect(firstUnsave.body.data).toEqual({ id: foodItem.id, saved: false });
    expect(secondUnsave.body.data).toEqual({ id: foodItem.id, saved: false });
    expect(await prisma.savedFoodItem.count()).toBe(0);
  });

  it('returns saved state in food item responses', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        name: 'Saved banana',
        normalizedName: 'saved banana',
        searchText: 'saved banana',
        sourceType: 'app_owned',
        foodType: 'generic',
      },
    });
    await prisma.savedFoodItem.create({
      data: { userId: MOCK_USER_ID, foodItemId: foodItem.id },
    });

    const response = await api
      .get(`/api/v1/food-items/${foodItem.id}`)
      .expect(200);

    expect(response.body.data.isSaved).toBe(true);
  });

  it('looks up local barcodes with exact region before GLOBAL fallback', async () => {
    const globalFood = await prisma.foodItem.create({
      data: {
        name: 'Global cereal',
        normalizedName: 'global cereal',
        searchText: 'global cereal',
        sourceType: 'cached_external',
        foodType: 'branded',
      },
    });
    const usFood = await prisma.foodItem.create({
      data: {
        name: 'US cereal',
        normalizedName: 'us cereal',
        searchText: 'us cereal',
        sourceType: 'cached_external',
        foodType: 'branded',
      },
    });
    await prisma.foodBarcode.create({
      data: {
        foodItemId: globalFood.id,
        barcode: '012345678905',
        regionCode: 'GLOBAL',
      },
    });
    await prisma.foodBarcode.create({
      data: {
        foodItemId: usFood.id,
        barcode: '012345678905',
        regionCode: 'US',
      },
    });

    const exact = await api
      .get('/api/v1/food-items/barcode/012345678905')
      .query({ regionCode: 'US' })
      .expect(200);
    const fallback = await api
      .get('/api/v1/food-items/barcode/012345678905')
      .query({ regionCode: 'CA' })
      .expect(200);

    expect(exact.body.data.name).toBe('US cereal');
    expect(fallback.body.data.name).toBe('Global cereal');
  });

  it('returns a local cached barcode match before calling Open Food Facts', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const foodItem = await prisma.foodItem.create({
      data: {
        name: 'Cached cereal',
        normalizedName: 'cached cereal',
        searchText: 'cached cereal',
        sourceType: 'cached_external',
        sourceProvider: 'open_food_facts',
        sourceId: '4444444444444',
        foodType: 'branded',
        calories: 180,
        protein: 6,
      },
    });
    await prisma.foodBarcode.create({
      data: {
        foodItemId: foodItem.id,
        barcode: '4444444444444',
        regionCode: 'US',
      },
    });

    const response = await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '4444444444444', regionCode: 'us' })
      .expect(200);

    expectSuccessEnvelope(response.body);
    expect(response.body.data).toMatchObject({
      id: foodItem.id,
      name: 'Cached cereal',
      sourceProvider: 'open_food_facts',
      calories: 180,
      protein: 6,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('matches a UPC-A lookup to a local cached EAN-13 alias', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        name: 'Canadian cola',
        normalizedName: 'canadian cola',
        searchText: 'canadian cola',
        sourceType: 'cached_external',
        sourceProvider: 'open_food_facts',
        sourceId: '0069000013762',
        foodType: 'branded',
      },
    });
    await prisma.foodBarcode.create({
      data: {
        foodItemId: foodItem.id,
        barcode: '0069000013762',
        regionCode: 'CA',
      },
    });

    const response = await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '069000013762', regionCode: 'ca' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: foodItem.id,
      name: 'Canadian cola',
    });
  });

  it('matches an EAN-13 leading-zero lookup to a local cached UPC-A alias', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        name: 'US cola',
        normalizedName: 'us cola',
        searchText: 'us cola',
        sourceType: 'cached_external',
        sourceProvider: 'open_food_facts',
        sourceId: '069000013762',
        foodType: 'branded',
      },
    });
    await prisma.foodBarcode.create({
      data: {
        foodItemId: foodItem.id,
        barcode: '069000013762',
        regionCode: 'US',
      },
    });

    const response = await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '0069000013762', regionCode: 'us' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: foodItem.id,
      name: 'US cola',
    });
  });

  it('caches a usable Open Food Facts barcode product as a FoodItem and FoodBarcode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            result: { id: 'product_found' },
            product: {
              code: '3017624010701',
              product_name: 'Nutella',
              brands: 'Ferrero',
              quantity: '400 g',
              product_quantity: 400,
              product_quantity_unit: 'g',
              nutrition_data_per: '100g',
              last_modified_t: 1_782_330_807,
              nutriments: {
                'energy-kcal_100g': 539,
                proteins_100g: 6.3,
                carbohydrates_100g: 57.5,
                fat_100g: 30.9,
                sugars_100g: 56.3,
                sodium_100g: 0.043,
                'saturated-fat_100g': 10.6,
                'saturated-fat_unit': 'g',
                calcium_100g: 108,
                calcium_unit: 'mg',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const response = await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '3017624010701', regionCode: 'ca' })
      .expect(200);

    expectSuccessEnvelope(response.body);
    expect(response.body.data).toMatchObject({
      name: 'Nutella',
      brandName: 'Ferrero',
      sourceType: 'cached_external',
      foodType: 'branded',
      sourceProvider: 'open_food_facts',
      sourceId: '3017624010701',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      calories: 539,
      protein: 6.3,
      carbs: 57.5,
      fat: 30.9,
      sugar: 56.3,
      sodium: 43,
      nutrients: {
        calcium: { amount: 108, unit: 'mg' },
        saturatedFat: { amount: 10.6, unit: 'g' },
      },
    });
    const data = response.body.data as { barcodes: unknown[] };
    expect(data.barcodes).toEqual([
      expect.objectContaining({
        barcode: '3017624010701',
        regionCode: 'CA',
      }),
    ]);

    const cachedBarcode = await prisma.foodBarcode.findUnique({
      where: {
        barcode_regionCode: { barcode: '3017624010701', regionCode: 'CA' },
      },
      include: { foodItem: true },
    });
    expect(cachedBarcode?.foodItem.userId).toBeNull();
    expect(cachedBarcode?.foodItem.sourceType).toBe('cached_external');
    expect(cachedBarcode?.foodItem.sourceProvider).toBe('open_food_facts');
  });

  it('tries equivalent UPC-A and EAN-13 candidates against Open Food Facts', async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string | URL) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/069000013762.json')) {
        return Promise.resolve(new Response('{}', { status: 404 }));
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: 'success',
            result: { id: 'product_found' },
            product: {
              code: '0069000013762',
              product_name: 'Pepsi Zero Sugar',
              brands: 'Pepsi',
              nutrition_data_per: '100g',
              nutriments: {
                'energy-kcal_100g': 0,
                proteins_100g: 0,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '0069000013762', regionCode: 'ca' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      name: 'Pepsi Zero Sugar',
      sourceId: '0069000013762',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/069000013762.json');
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
      '/0069000013762.json',
    );
  });

  it('caches safe UPC-A and EAN-13 aliases for Open Food Facts results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            result: { id: 'product_found' },
            product: {
              code: '069000013762',
              product_name: 'Pepsi Zero Sugar',
              brands: 'Pepsi',
              nutrition_data_per: '100g',
              nutriments: {
                'energy-kcal_100g': 0,
                proteins_100g: 0,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '0069000013762', regionCode: 'ca' })
      .expect(200);

    const cachedBarcodes = await prisma.foodBarcode.findMany({
      orderBy: { barcode: 'asc' },
    });

    expect(cachedBarcodes.map((barcode) => barcode.barcode)).toEqual([
      '0069000013762',
      '069000013762',
    ]);
    expect(cachedBarcodes.every((barcode) => barcode.regionCode === 'CA')).toBe(
      true,
    );
  });

  it('reuses the local cache after an Open Food Facts lookup', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          result: { id: 'product_found' },
          product: {
            code: '5555555555555',
            product_name: 'Protein bar',
            brands: 'Fast Fuel',
            serving_size: '60 g',
            nutrition_data_per: 'serving',
            nutriments: {
              'energy-kcal_serving': 220,
              proteins_serving: 20,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '5555555555555' })
      .expect(200);
    const second = await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '5555555555555' })
      .expect(200);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second.body.data).toMatchObject({
      name: 'Protein bar',
      calories: 220,
      protein: 20,
    });
  });

  it('returns not found when Open Food Facts has no usable product name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 'success',
            result: { id: 'product_found' },
            product: {
              code: '9999999999999',
              brands: 'Unknown Brand',
              nutriments: {
                'energy-kcal_100g': 120,
                proteins_100g: 4,
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const response = await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: '9999999999999' })
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
    expect(response.body.error.message).toBe('Food barcode not found');
    expect(await prisma.foodBarcode.count()).toBe(0);
    expect(await prisma.foodItem.count()).toBe(0);
  });

  it('rejects invalid non-retail barcode lookup input', async () => {
    const response = await api
      .post('/api/v1/food-items/barcode/lookup')
      .send({ barcode: 'not-a-retail-code' })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
    expect(response.body.error.message).toBe(
      'Barcode must be a supported retail barcode.',
    );
  });

  it('enforces barcode uniqueness per region', async () => {
    const foodItem = await prisma.foodItem.create({
      data: {
        name: 'Barcode food',
        normalizedName: 'barcode food',
        searchText: 'barcode food',
        sourceType: 'cached_external',
        foodType: 'branded',
      },
    });
    const duplicateBarcode = {
      foodItemId: foodItem.id,
      barcode: '222222222222',
      regionCode: 'US',
    };

    await prisma.foodBarcode.create({ data: duplicateBarcode });

    await expect(
      prisma.foodBarcode.create({ data: duplicateBarcode }),
    ).rejects.toThrow();
  });

  it('keeps barcode lookup route from being intercepted by the id route', async () => {
    const response = await api
      .get('/api/v1/food-items/barcode/000000000000')
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
    expect(response.body.error.message).toBe('Food barcode not found');
  });

  it('does not return another user custom food through barcode lookup', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const otherFood = await prisma.foodItem.create({
      data: {
        userId: OTHER_USER_ID,
        name: 'Private barcode food',
        normalizedName: 'private barcode food',
        searchText: 'private barcode food',
        sourceType: 'user_custom',
        foodType: 'branded',
      },
    });
    await prisma.foodBarcode.create({
      data: {
        foodItemId: otherFood.id,
        barcode: '111111111111',
        regionCode: 'GLOBAL',
      },
    });

    const response = await api
      .get('/api/v1/food-items/barcode/111111111111')
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });

  it('returns not found for missing food item ids', async () => {
    const response = await api
      .get(`/api/v1/food-items/${MISSING_FOOD_ITEM_ID}`)
      .expect(404);

    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });
});
