import { MOCK_USER_ID } from '@food-tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { clearUsdaFdcCaches } from '../src/modules/foodItems/usda-fdc.js';
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
    clearUsdaFdcCaches();
    delete process.env.GEMINI_API_KEY;
    delete process.env.USDA_FDC_API_KEY;
    delete process.env.USDA_FDC_SEARCH_LIMIT;
    delete process.env.USDA_FDC_TIMEOUT_MS;
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

  it('accepts Gemini JSON wrapped in markdown code fences', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: [
                          '```json',
                          JSON.stringify({
                            items: [
                              {
                                name: 'eggs',
                                quantityText: '2',
                                servingText: '2 eggs',
                              },
                            ],
                          }),
                          '```',
                        ].join('\n'),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs' })
      .expect(200);

    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        parsedName: 'eggs',
      }),
    ]);
  });

  it('returns clean AI unavailable for invalid Gemini JSON', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: '{not valid json' }],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs' })
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
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
      (candidate: { foodItem: { id: string } | null }) =>
        candidate.foodItem?.id,
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

  it('adds USDA generic candidates with explicit serving basis when no local loggable match exists', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '1';
    const fetchSpy = vi.fn(async (url: string | URL) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/foods/search')) {
        return new Response(
          JSON.stringify({
            foods: [
              {
                fdcId: 173944,
                description: 'Bananas, raw',
                dataType: 'Foundation',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          fdcId: 173944,
          description: 'Bananas, raw',
          dataType: 'Foundation',
          publicationDate: '2019-04-01',
          foodNutrients: [
            {
              amount: 89,
              nutrient: { name: 'Energy', unitName: 'KCAL' },
            },
            {
              amount: 1.09,
              nutrient: { name: 'Protein', unitName: 'G' },
            },
            {
              amount: 22.84,
              nutrient: {
                name: 'Carbohydrate, by difference',
                unitName: 'G',
              },
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
      );
    });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'banana' })
      .expect(200);

    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        parsedName: 'banana',
        reviewStatus: 'needs_review',
        loggable: true,
        selectedCandidateId: 'usda_fdc:173944',
        candidates: [
          expect.objectContaining({
            candidateType: 'external_food',
            matchReason: 'usda_fdc',
            confidence: 'high',
            defaultServingMultiplier: 1,
            externalFood: expect.objectContaining({
              sourceProvider: 'usda_fdc',
              sourceId: '173944',
              name: 'Bananas, raw',
              servingBasisText: 'per 100 g',
              servingQuantity: 100,
              servingUnit: 'g',
              calories: 89,
              protein: 1.1,
              carbs: 22.8,
              fiber: 2.6,
              nutrients: {
                potassium: { amount: 358, unit: 'mg' },
              },
            }),
          }),
        ],
      }),
    ]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not call USDA when a local nutrient-backed candidate exists', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const localFood = await createFoodItem({
      userId: null,
      name: 'Banana',
      sourceType: 'app_owned',
      calories: 105,
      protein: 1.3,
    });

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'banana' })
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      reviewStatus: 'matched',
      loggable: true,
      selectedCandidateId: localFood.id,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('adds a relevant USDA generic candidate for parsed plural eggs', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 748967,
                  description: 'Egg, whole, cooked, hard-boiled',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            fdcId: 748967,
            description: 'Egg, whole, cooked, hard-boiled',
            dataType: 'Foundation',
            publicationDate: '2019-04-01',
            foodNutrients: [
              { amount: 143, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 12.6, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs' })
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      parsedName: 'eggs',
      reviewStatus: 'needs_review',
      loggable: true,
      selectedCandidateId: 'usda_fdc:748967',
      candidates: [
        expect.objectContaining({
          candidateType: 'external_food',
          confidence: 'high',
          externalFood: expect.objectContaining({
            name: 'Egg, whole, cooked, hard-boiled',
            calories: 143,
            protein: 12.6,
          }),
        }),
      ],
    });
  });

  it('skips stale USDA detail failures and uses another relevant candidate', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 111,
                  description: 'Egg, stale record',
                  dataType: 'Foundation',
                },
                {
                  fdcId: 222,
                  description: 'Egg, whole, cooked, hard-boiled',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (requestUrl.includes('/food/111')) {
          return new Response(JSON.stringify({ error: 'not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({
            fdcId: 222,
            description: 'Egg, whole, cooked, hard-boiled',
            dataType: 'Foundation',
            publicationDate: '2019-04-01',
            foodNutrients: [
              { amount: 143, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 12.6, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs' })
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      loggable: true,
      selectedCandidateId: 'usda_fdc:222',
    });
  });

  it('keeps unmatched local-only behavior when USDA is not configured', async () => {
    delete process.env.USDA_FDC_API_KEY;

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'banana' })
      .expect(200);

    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        parsedName: 'banana',
        reviewStatus: 'unmatched',
        loggable: false,
        selectedCandidateId: null,
        candidates: [],
      }),
    ]);
  });

  it('returns unresolved rows when USDA search fails during parse', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'upstream unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'boiled plantain' })
      .expect(200);

    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        parsedName: 'boiled plantain',
        reviewStatus: 'unmatched',
        loggable: false,
        selectedCandidateId: null,
        candidates: [],
      }),
    ]);
  });

  it('returns unresolved rows when USDA detail normalization is unsafe during parse', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 999,
                  description: 'Plantains, boiled',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            fdcId: 999,
            dataType: 'Foundation',
            publicationDate: 'not-a-date',
            foodNutrients: [
              { amount: 122, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 1.3, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'boiled plantain' })
      .expect(200);

    expect(response.body.data.items).toEqual([
      expect.objectContaining({
        parsedName: 'boiled plantain',
        reviewStatus: 'needs_review',
        loggable: false,
        selectedCandidateId: null,
        candidates: [
          expect.objectContaining({
            candidateType: 'external_food',
            confidence: 'medium',
            externalFood: expect.objectContaining({
              sourceId: '999',
              servingBasisText: 'USDA nutrition details unavailable (invalid)',
              calories: null,
              protein: null,
            }),
          }),
        ],
      }),
    ]);
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

  it('does not estimate nutrition when trusted candidates exist', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await createFoodItem({
      userId: null,
      name: 'Banana',
      sourceType: 'app_owned',
      calories: 105,
      protein: 1.3,
    });

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'banana',
        quantityText: null,
        servingText: null,
        description: 'banana',
      })
      .expect(409);

    expectErrorEnvelope(response.body, 'TRUSTED_NUTRITION_AVAILABLE');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not estimate nutrition for relevant USDA eggs candidates', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '1';
    const fetchSpy = vi.fn(async (url: string | URL) => {
      const requestUrl = String(url);

      if (requestUrl.includes('/foods/search')) {
        return new Response(
          JSON.stringify({
            foods: [
              {
                fdcId: 748967,
                description: 'Egg, whole, cooked, hard-boiled',
                dataType: 'Foundation',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (requestUrl.includes('/food/748967')) {
        return new Response(
          JSON.stringify({
            fdcId: 748967,
            description: 'Egg, whole, cooked, hard-boiled',
            dataType: 'Foundation',
            publicationDate: '2019-04-01',
            foodNutrients: [
              { amount: 143, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 12.6, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      throw new Error('Gemini estimate provider should not be called');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'eggs',
        quantityText: '2 eggs',
        servingText: '2 eggs',
      })
      .expect(409);

    expectErrorEnvelope(response.body, 'TRUSTED_NUTRITION_AVAILABLE');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('does not let raw USDA eggs block the low-trust estimate fallback', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 748968,
                  description: 'Egg, whole, raw, fresh',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            fdcId: 748968,
            description: 'Egg, whole, raw, fresh',
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 143, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 12.6, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'eggs',
        quantityText: '2 eggs',
        servingText: '2 eggs',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      source: 'ai_estimate',
      trustLevel: 'low',
    });
  });

  it('returns low-trust basic AI nutrition only for unresolved rows', async () => {
    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'homemade ghanaian stew with rice',
        quantityText: null,
        servingText: '1 bowl',
        description: 'homemade Ghanaian stew with rice',
      })
      .expect(200);

    expect(response.body.data).toEqual({
      source: 'ai_estimate',
      trustLevel: 'low',
      foodName: 'homemade ghanaian stew with rice',
      servingText: '1 bowl',
      calories: 400,
      protein: 20,
      carbs: 40,
      fat: 15,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: {},
    });
  });

  it('parses Gemini nutrition estimates from structured output text parts', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    type GeminiRequestBody = {
      generationConfig?: {
        maxOutputTokens?: number;
        responseSchema?: {
          properties?: Record<string, Record<string, unknown>>;
        };
      };
    };
    let capturedBody: GeminiRequestBody | null = null;

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
                    {},
                    {
                      text: JSON.stringify({
                        foodName: 'teiko moonlit custom bowl',
                        servingText: '1 bowl',
                        calories: 410,
                        protein: 16,
                        carbs: 52,
                        fat: 14,
                        fiber: null,
                        sugar: null,
                        sodium: null,
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

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'teiko moonlit custom bowl',
        quantityText: '1 bowl',
        servingText: '1 bowl',
      })
      .expect(200);

    expect(capturedBody).toMatchObject({
      generationConfig: {
        maxOutputTokens: 768,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
        },
      },
    });
    const requestBody = capturedBody as unknown as GeminiRequestBody;
    expect(
      requestBody.generationConfig?.responseSchema?.properties?.calories?.type,
    ).toBe('number');
    expect(
      requestBody.generationConfig?.responseSchema?.properties?.sodium?.type,
    ).toBe('number');
    expect(
      requestBody.generationConfig?.responseSchema?.properties?.fiber,
    ).not.toHaveProperty('nullable');
    expect(
      requestBody.generationConfig?.responseSchema?.properties,
    ).not.toHaveProperty('nutrients');
    expect(response.body.data).toEqual({
      source: 'ai_estimate',
      trustLevel: 'low',
      foodName: 'teiko moonlit custom bowl',
      servingText: '1 bowl',
      calories: 410,
      protein: 16,
      carbs: 52,
      fat: 14,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: {},
    });
  });

  it('returns AI unavailable with safe diagnostics when Gemini nutrition response has no text part', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'SAFETY',
                  safetyRatings: [
                    {
                      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                      probability: 'LOW',
                    },
                  ],
                  content: {
                    parts: [
                      {
                        functionCall: { name: 'unexpected_tool_call' },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'teiko moonlit custom bowl',
        quantityText: '1 bowl',
        servingText: '1 bowl',
      })
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
    expect(warnSpy).toHaveBeenCalledWith(
      '[ai-food-parse:gemini]',
      expect.objectContaining({
        category: 'nutrition_estimate_missing_text_part',
        status: 200,
        candidates: 1,
        finishReasons: ['SAFETY'],
        partShapes: [[{ functionCall: 'object' }]],
        safetyRatings: [
          [
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              probability: 'LOW',
            },
          ],
        ],
      }),
    );
  });

  it('returns a clear AI unavailable error when Gemini nutrition estimate is cut off by max tokens', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'MAX_TOKENS',
                  content: {
                    parts: [],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'homemade Ghanaian palm nut soup',
        quantityText: '1 bowl',
        servingText: '1 bowl',
      })
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
    expect(response.body.error.message).toBe(
      'AI nutrition estimates were cut off. Try again.',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[ai-food-parse:gemini]',
      expect.objectContaining({
        category: 'nutrition_estimate_max_tokens',
        status: 200,
        candidates: 1,
        finishReasons: ['MAX_TOKENS'],
        partShapes: [[]],
      }),
    );
  });

  it('tries later Gemini text parts when earlier parts are not valid estimate JSON', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: 'Here is an approximate estimate. Please review it.',
                      },
                      {
                        text: JSON.stringify({
                          foodName: 'teiko moonlit custom bowl',
                          servingText: '1 bowl',
                          calories: 410,
                          protein: 16,
                          carbs: 52,
                          fat: 14,
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'teiko moonlit custom bowl',
        quantityText: '1 bowl',
        servingText: '1 bowl',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      source: 'ai_estimate',
      trustLevel: 'low',
      calories: 410,
      protein: 16,
      carbs: 52,
      fat: 14,
      nutrients: {},
    });
  });

  it('accepts Gemini nutrition estimate JSON wrapped in markdown code fences', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: [
                          '```json',
                          JSON.stringify({
                            foodName: 'teiko moonlit custom bowl',
                            servingText: '1 bowl',
                            calories: 410,
                            protein: 16,
                            carbs: 52,
                            fat: 14,
                          }),
                          '```',
                        ].join('\n'),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'teiko moonlit custom bowl',
        quantityText: '1 bowl',
        servingText: '1 bowl',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      source: 'ai_estimate',
      trustLevel: 'low',
      calories: 410,
      protein: 16,
      carbs: 52,
      fat: 14,
      nutrients: {},
    });
  });

  it('extracts valid Gemini nutrition estimate JSON from surrounding prose', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: [
                          'Approximate estimate for review:',
                          JSON.stringify({
                            foodName: 'teiko moonlit custom bowl',
                            servingText: '1 bowl',
                            calories: 410,
                            protein: 16,
                            carbs: 52,
                            fat: 14,
                          }),
                          'Adjust before saving.',
                        ].join('\n'),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'teiko moonlit custom bowl',
        quantityText: '1 bowl',
        servingText: '1 bowl',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      source: 'ai_estimate',
      trustLevel: 'low',
      calories: 410,
      protein: 16,
      carbs: 52,
      fat: 14,
      nutrients: {},
    });
  });

  it('returns AI unavailable when no Gemini nutrition text part contains a valid estimate', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      { text: 'I cannot estimate that.' },
                      {
                        text: JSON.stringify({
                          foodName: 'teiko moonlit custom bowl',
                          calories: -1,
                          protein: 16,
                          carbs: 52,
                          fat: 14,
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'teiko moonlit custom bowl',
        quantityText: '1 bowl',
        servingText: '1 bowl',
      })
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
  });

  it.each([429, 503])(
    'returns temporary AI unavailable for Gemini nutrition upstream %i',
    async (status) => {
      process.env.AI_PROVIDER = 'gemini';
      process.env.GEMINI_API_KEY = 'test-key';

      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(JSON.stringify({ error: { status } }), {
              status,
              statusText: status === 429 ? 'Too Many Requests' : 'Unavailable',
              headers: { 'Content-Type': 'application/json' },
            }),
        ),
      );

      const response = await api
        .post('/api/v1/ai/nutrition-estimate')
        .send({
          parsedName: 'teiko moonlit custom bowl',
          quantityText: '1 bowl',
          servingText: '1 bowl',
        })
        .expect(503);

      expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
      expect(response.body.error.message).toBe(
        'AI nutrition estimates are temporarily unavailable.',
      );
    },
  );

  it('does not block estimates for weak USDA token-only matches', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 333,
                  description: 'Rice bowl with chicken',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            fdcId: 333,
            description: 'Rice bowl with chicken',
            dataType: 'Foundation',
            publicationDate: '2020-01-01',
            foodNutrients: [
              { amount: 180, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 7, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'teiko moonlit custom bowl',
        quantityText: '1 bowl',
        servingText: '1 bowl',
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      source: 'ai_estimate',
      trustLevel: 'low',
      foodName: 'teiko moonlit custom bowl',
    });
  });

  it('uses better USDA candidates when weak local candidates exist during parse', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '2';
    await createFoodItem({
      userId: null,
      name: 'Banana powder',
      sourceType: 'cached_external',
      calories: 360,
      protein: 4,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 173944,
                  description: 'Bananas, raw',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            fdcId: 173944,
            description: 'Bananas, raw',
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 89, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 1.09, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'banana' })
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      parsedName: 'banana',
      selectedCandidateId: 'usda_fdc:173944',
    });
    expect(response.body.data.items[0].candidates[0]).toMatchObject({
      candidateType: 'external_food',
      externalFood: expect.objectContaining({ name: 'Bananas, raw' }),
    });
  });

  it('bounds AI parse USDA detail enrichment after metadata ranking', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '6';
    await createFoodItem({
      userId: null,
      name: 'Rice prepared meal',
      sourceType: 'cached_external',
      calories: 220,
      protein: 4,
    });
    const detailIds: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: Array.from({ length: 12 }, (_, index) => ({
                fdcId: 400 + index,
                description:
                  index === 9
                    ? 'Rice, white, cooked'
                    : `Rice prepared meal restaurant ${index}`,
                dataType: index === 9 ? 'Foundation' : 'Survey (FNDDS)',
              })),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const id = requestUrl.match(/\/food\/(\d+)/)?.[1] ?? 'unknown';
        detailIds.push(id);
        return new Response(
          JSON.stringify({
            fdcId: Number(id),
            description:
              id === '409' ? 'Rice, white, cooked' : `Rice fallback ${id}`,
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 130, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 2.4, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: 'rice' })
      .expect(200);

    expect(detailIds).toHaveLength(3);
    expect(detailIds.length).toBeLessThanOrEqual(8);
    expect(detailIds[0]).toBe('409');
    expect(response.body.data.items[0]).toMatchObject({
      selectedCandidateId: 'usda_fdc:409',
    });
  });

  it('resolves 2 eggs, toast, banana through trusted candidates', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '2';
    const foodsByQuery = new Map([
      ['egg', { fdcId: 1, name: 'Egg, whole, cooked, scrambled' }],
      ['toast', { fdcId: 2, name: 'Bread, whole-wheat, toasted' }],
      ['banana', { fdcId: 3, name: 'Bananas, raw' }],
    ]);
    const misleadingFoodsByQuery = new Map([
      ['egg', { fdcId: 4, name: 'Bread, egg, toasted' }],
      ['toast', { fdcId: 4, name: 'Bread, egg, toasted' }],
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          const body = JSON.parse(String(init?.body)) as { query: string };
          const match = foodsByQuery.get(body.query);
          const misleading = misleadingFoodsByQuery.get(body.query);

          return new Response(
            JSON.stringify({
              foods:
                match === undefined
                  ? []
                  : [
                      ...(misleading === undefined
                        ? []
                        : [
                            {
                              fdcId: misleading.fdcId,
                              description: misleading.name,
                              dataType: 'Foundation',
                            },
                          ]),
                      {
                        fdcId: match.fdcId,
                        description: match.name,
                        dataType: 'Foundation',
                      },
                    ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const match = [
          ...foodsByQuery.values(),
          ...misleadingFoodsByQuery.values(),
        ].find((food) => requestUrl.includes(`/food/${food.fdcId}`));

        return new Response(
          JSON.stringify({
            fdcId: match?.fdcId ?? 999,
            description: match?.name ?? 'Unknown',
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 100, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 5, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs, toast, banana' })
      .expect(200);

    expect(response.body.data.items).toMatchObject([
      {
        parsedName: 'eggs',
        loggable: true,
        selectedCandidateId: 'usda_fdc:1',
      },
      {
        parsedName: 'toast',
        loggable: true,
        selectedCandidateId: 'usda_fdc:2',
      },
      {
        parsedName: 'banana',
        loggable: true,
        selectedCandidateId: 'usda_fdc:3',
      },
    ]);
  });

  it('still blocks estimates for relevant USDA candidates', async () => {
    process.env.USDA_FDC_API_KEY = 'test-usda-key';
    process.env.USDA_FDC_SEARCH_LIMIT = '1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 173944,
                  description: 'Bananas, raw',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            fdcId: 173944,
            description: 'Bananas, raw',
            dataType: 'Foundation',
            publicationDate: '2019-04-01',
            foodNutrients: [
              { amount: 89, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 1.09, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'banana',
        quantityText: '1 banana',
        servingText: '1 banana',
      })
      .expect(409);

    expectErrorEnvelope(response.body, 'TRUSTED_NUTRITION_AVAILABLE');
  });

  it.each([
    ['rice', 'Rice, white, cooked'],
    ['chicken breast', 'Chicken, broilers or fryers, breast, meat only'],
    ['milk', 'Milk, fluid, whole'],
    ['oats', 'Oats, cooked'],
    ['apple', 'Apples, raw, with skin'],
    ['salmon', 'Salmon, Atlantic, cooked, dry heat'],
    ['toast', 'Bread, whole-wheat, toasted'],
    ['peanut butter', 'Peanut butter, smooth style'],
    ['Greek yogurt', 'Yogurt, Greek, plain'],
  ])(
    'blocks AI estimates when trusted %s candidates exist',
    async (query, name) => {
      process.env.USDA_FDC_API_KEY = 'test-usda-key';
      process.env.USDA_FDC_SEARCH_LIMIT = '2';
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string | URL) => {
          const requestUrl = String(url);

          if (requestUrl.includes('/foods/search')) {
            return new Response(
              JSON.stringify({
                foods: [
                  {
                    fdcId: 777,
                    description: name,
                    dataType: 'Foundation',
                  },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }

          return new Response(
            JSON.stringify({
              fdcId: 777,
              description: name,
              dataType: 'Foundation',
              foodNutrients: [
                { amount: 100, nutrient: { name: 'Energy', unitName: 'KCAL' } },
                { amount: 5, nutrient: { name: 'Protein', unitName: 'G' } },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }),
      );

      const response = await api
        .post('/api/v1/ai/nutrition-estimate')
        .send({
          parsedName: query,
          quantityText: null,
          servingText: null,
        })
        .expect(409);

      expectErrorEnvelope(response.body, 'TRUSTED_NUTRITION_AVAILABLE');
    },
  );

  it('rejects AI nutrition estimates that include full micronutrients', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          foodName: 'mystery stew',
                          servingText: '1 bowl',
                          calories: 420,
                          protein: 18,
                          carbs: 50,
                          fat: 14,
                          vitaminC: 30,
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/nutrition-estimate')
      .send({
        parsedName: 'mystery stew',
        servingText: '1 bowl',
      })
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
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
