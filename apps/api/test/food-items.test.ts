import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
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

interface FoodItemResponseBody {
  id: string;
  name: string;
}

interface FoodItemsListResponseBody {
  foodItems: FoodItemResponseBody[];
}

describe('food items API', () => {
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
