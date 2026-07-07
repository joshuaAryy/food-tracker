import { MOCK_USER_ID } from '@food-tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

async function createFoodItem(input: {
  userId: string | null;
  name: string;
  sourceType: 'user_custom' | 'app_owned' | 'cached_external';
  calories?: number | null;
  protein?: number | null;
}) {
  const normalizedName = input.name.trim().toLocaleLowerCase();

  return prisma.foodItem.create({
    data: {
      userId: input.userId,
      name: input.name,
      normalizedName,
      searchText: normalizedName,
      sourceType: input.sourceType,
      foodType: 'generic',
      calories: input.calories ?? 100,
      protein: input.protein ?? 10,
    },
  });
}

describe('AI food parse API', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = 'mock';
    process.env.AI_FOOD_PARSE_RATE_LIMIT_MAX = '100';
    process.env.AI_FOOD_PARSE_RATE_LIMIT_WINDOW = '600000';
    process.env.AI_FOOD_PARSE_DAILY_LIMIT = '100';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it('rejects unknown input fields', async () => {
    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs and toast', userId: MOCK_USER_ID })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('returns AI unavailable without creating logs when provider is disabled', async () => {
    process.env.AI_PROVIDER = 'disabled';

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs and toast' })
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('does not require a Gemini API key until the parse feature is used', async () => {
    process.env.AI_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;

    await api.get('/api/v1/food-items').expect(200);

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'protein shake with milk' })
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
  });

  it('sends Gemini generateContent JSON output using responseMimeType and responseSchema', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_FOOD_PARSE_MODEL = 'gemini-2.5-flash';
    let capturedBody: unknown;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        items: [
                          {
                            name: 'eggs',
                            quantityText: '2',
                            servingText: '2',
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs' })
      .expect(200);

    expect(capturedBody).toMatchObject({
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
        },
      },
    });
  });

  it('retrieves candidates in trusted priority order and hides other users custom foods', async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });

    const cached = await createFoodItem({
      userId: null,
      name: 'Eggs',
      sourceType: 'cached_external',
    });
    const appOwned = await createFoodItem({
      userId: null,
      name: 'Eggs',
      sourceType: 'app_owned',
    });
    const custom = await createFoodItem({
      userId: MOCK_USER_ID,
      name: 'Eggs',
      sourceType: 'user_custom',
    });
    const saved = await createFoodItem({
      userId: null,
      name: 'Eggs',
      sourceType: 'app_owned',
    });
    const recent = await createFoodItem({
      userId: MOCK_USER_ID,
      name: 'Eggs',
      sourceType: 'user_custom',
    });
    const otherUserFood = await createFoodItem({
      userId: OTHER_USER_ID,
      name: 'Eggs',
      sourceType: 'user_custom',
    });

    await prisma.savedFoodItem.create({
      data: { userId: MOCK_USER_ID, foodItemId: saved.id },
    });
    await prisma.foodLog.create({
      data: {
        userId: MOCK_USER_ID,
        foodItemId: recent.id,
        foodName: 'Eggs',
        mealType: 'breakfast',
        calories: 140,
        protein: 12,
        loggedAt: new Date('2026-07-06T12:00:00.000Z'),
      },
    });

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs' })
      .expect(200);

    const item = response.body.data.items[0];
    const candidateIds = item.candidates.map(
      (candidate: { foodItem: { id: string } }) => candidate.foodItem.id,
    );

    expect(response.body.data).toMatchObject({
      description: '2 eggs',
      items: [
        {
          parsedName: 'eggs',
          reviewStatus: 'matched',
          loggable: true,
          selectedCandidateId: recent.id,
        },
      ],
    });
    expect(candidateIds.slice(0, 5)).toEqual([
      recent.id,
      saved.id,
      custom.id,
      appOwned.id,
      cached.id,
    ]);
    expect(candidateIds).not.toContain(otherUserFood.id);
  });

  it('returns unmatched items as review-only and not loggable', async () => {
    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'dragonfruit smoothie' })
      .expect(200);

    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        parsedName: 'dragonfruit smoothie',
        reviewStatus: 'unmatched',
        loggable: false,
        selectedCandidateId: null,
        candidates: [],
      }),
    ]);
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('rate limits AI parse requests before provider work', async () => {
    process.env.AI_FOOD_PARSE_RATE_LIMIT_MAX = '1';
    process.env.AI_FOOD_PARSE_RATE_LIMIT_WINDOW = '600000';
    process.env.AI_FOOD_PARSE_DAILY_LIMIT = '25';

    await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs' })
      .expect(200);

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'toast with butter' })
      .expect(429);

    expectErrorEnvelope(response.body, 'RATE_LIMITED');
  });
});
