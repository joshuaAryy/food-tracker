import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearUsdaFdcCaches,
  enrichUsdaFoods,
  fetchUsdaFood,
  rankUsdaSearchFoods,
  searchUsdaFoods,
  type UsdaFdcConfig,
} from '../src/modules/foodItems/usda-fdc.js';

const config: UsdaFdcConfig = {
  apiKey: 'test-usda-key',
  baseUrl: 'https://api.nal.usda.gov/fdc/v1',
  timeoutMs: 5000,
  searchLimit: 3,
  rateLimitWindowMs: 600_000,
  rateLimitMax: 100,
};

describe('USDA FDC enrichment utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearUsdaFdcCaches();
  });

  it('caches detail timeouts briefly so repeated requests avoid the slow source', async () => {
    const fetchSpy = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const first = await fetchUsdaFood({
      sourceId: '401',
      config,
      timeoutMs: 1,
    });
    const second = await fetchUsdaFood({
      sourceId: '401',
      config,
      timeoutMs: 1,
    });

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('bounds concurrent detail fetches during enrichment', async () => {
    let activeDetailFetches = 0;
    let maxActiveDetailFetches = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);

        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: Array.from({ length: 8 }, (_, index) => ({
                fdcId: 500 + index,
                description:
                  index === 4
                    ? 'Rice, white, cooked'
                    : `Rice fallback ${index}`,
                dataType: 'Foundation',
              })),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        activeDetailFetches += 1;
        maxActiveDetailFetches = Math.max(
          maxActiveDetailFetches,
          activeDetailFetches,
        );
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeDetailFetches -= 1;

        const id = requestUrl.match(/\/food\/(\d+)/)?.[1] ?? '500';
        return new Response(
          JSON.stringify({
            fdcId: Number(id),
            description: id === '504' ? 'Rice, white, cooked' : `Rice ${id}`,
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

    const foods = await enrichUsdaFoods({
      query: 'rice',
      config,
      rateLimitKey: 'test:concurrency',
      policy: {
        metadataLimit: 8,
        detailWindow: 8,
        concurrency: 3,
        detailTimeoutMs: 1000,
        totalBudgetMs: 3000,
      },
    });

    expect(foods).toHaveLength(8);
    expect(maxActiveDetailFetches).toBeLessThanOrEqual(3);
  });

  it('reports a timed-out detail while preserving the searchable candidate metadata', async () => {
    const unavailable: Array<{ id: number; reason: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 901,
                  description: 'Pasta with tomato sauce',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (requestUrl.includes('/food/901')) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          });
        }
        return new Response('{}', { status: 404 });
      }),
    );

    const foods = await enrichUsdaFoods({
      query: 'pasta',
      config,
      rateLimitKey: 'test:timeout-preservation',
      policy: {
        metadataLimit: 2,
        detailWindow: 1,
        concurrency: 1,
        detailTimeoutMs: 5,
        totalBudgetMs: 100,
      },
      onDetailUnavailable: ({ food, reason }) => {
        unavailable.push({ id: food.fdcId, reason });
      },
    });

    expect(foods).toEqual([]);
    expect(unavailable).toEqual([{ id: 901, reason: 'timeout' }]);
  });

  it('backfills past the initial detail window when relevant candidates are unloggable', async () => {
    const detailIds: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/foods/search')) {
          return new Response(
            JSON.stringify({
              foods: Array.from({ length: 7 }, (_, index) => ({
                fdcId: 700 + index,
                description: 'Rice, white, cooked',
                dataType: 'Foundation',
              })),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const id = requestUrl.match(/\/food\/(\d+)/)?.[1] ?? '700';
        detailIds.push(id);
        const loggable = id === '706';
        return new Response(
          JSON.stringify({
            fdcId: Number(id),
            description: 'Rice, white, cooked',
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 130, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              ...(loggable
                ? [
                    {
                      amount: 2.4,
                      nutrient: { name: 'Protein', unitName: 'G' },
                    },
                  ]
                : []),
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const foods = await enrichUsdaFoods({
      query: 'rice',
      config,
      rateLimitKey: 'test:backfill',
      policy: {
        metadataLimit: 7,
        detailWindow: 6,
        concurrency: 3,
        detailTimeoutMs: 1000,
        totalBudgetMs: 3000,
      },
      isEnough: (candidates) =>
        candidates.some(
          (food) => food.calories !== null && food.protein !== null,
        ),
    });

    expect(detailIds).toContain('706');
    expect(foods).toHaveLength(7);
  });

  it('supplements weak modifier-search metadata with a core-food search', async () => {
    const searchQueries: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/foods/search')) {
          const body = JSON.parse(String(init?.body)) as { query: string };
          searchQueries.push(body.query);
          return new Response(
            JSON.stringify({
              foods:
                body.query === 'egg cooked boiled'
                  ? [
                      {
                        fdcId: 802,
                        description: 'Egg, whole, cooked, hard-boiled',
                        dataType: 'Foundation',
                      },
                    ]
                  : [
                      {
                        fdcId: 801,
                        description: 'Egg, white, raw, frozen, pasteurized',
                        dataType: 'Foundation',
                      },
                    ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const id = requestUrl.match(/\/food\/(\d+)/)?.[1] ?? '801';
        return new Response(
          JSON.stringify({
            fdcId: Number(id),
            description:
              id === '802'
                ? 'Egg, whole, cooked, hard-boiled'
                : 'Egg, white, raw, frozen, pasteurized',
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 155, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 12.6, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const foods = await enrichUsdaFoods({
      query: 'boiled egg',
      config,
      rateLimitKey: 'test:modifier-fallback',
      policy: {
        metadataLimit: 8,
        detailWindow: 6,
        concurrency: 3,
        detailTimeoutMs: 1000,
        totalBudgetMs: 3000,
      },
    });

    expect(searchQueries).toEqual(['boiled egg', 'egg cooked boiled']);
    expect(foods.map((food) => food.sourceId)).toContain('802');
  });

  it('uses one edible-default fallback query when steak metadata lacks a usable default', async () => {
    const searchQueries: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/foods/search')) {
          const body = JSON.parse(String(init?.body)) as { query: string };
          searchQueries.push(body.query);
          return new Response(
            JSON.stringify({
              foods:
                body.query === 'beef steak cooked'
                  ? [
                      {
                        fdcId: 902,
                        description: 'Beef steak, grilled',
                        dataType: 'Foundation',
                      },
                    ]
                  : [
                      {
                        fdcId: 901,
                        description: 'Beef steak, raw',
                        dataType: 'Foundation',
                      },
                    ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const id = requestUrl.match(/\/food\/(\d+)/)?.[1] ?? '901';
        return new Response(
          JSON.stringify({
            fdcId: Number(id),
            description:
              id === '902' ? 'Beef steak, grilled' : 'Beef steak, raw',
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 200, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 26, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const foods = await enrichUsdaFoods({
      query: 'steak',
      config,
      rateLimitKey: 'test:steak-fallback',
      policy: {
        metadataLimit: 8,
        detailWindow: 6,
        concurrency: 3,
        detailTimeoutMs: 1000,
        totalBudgetMs: 3000,
      },
    });

    expect(searchQueries).toEqual(['steak', 'beef steak cooked']);
    expect(foods.map((food) => food.sourceId)).toContain('902');
  });

  it('budgets one logical enrichment for its bounded primary and fallback searches', async () => {
    const limitedConfig = { ...config, rateLimitMax: 1 };
    const searchQueries: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/foods/search')) {
          const body = JSON.parse(String(init?.body)) as { query: string };
          searchQueries.push(body.query);
          return new Response(
            JSON.stringify({
              foods: [
                body.query === 'cooked potato'
                  ? {
                      fdcId: 912,
                      description: 'Potatoes, boiled, cooked in skin, flesh',
                      dataType: 'Foundation',
                    }
                  : {
                      fdcId: 911,
                      description: 'Potatoes, raw, flesh and skin',
                      dataType: 'Foundation',
                    },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const id = requestUrl.match(/\/food\/(\d+)/)?.[1] ?? '911';
        return new Response(
          JSON.stringify({
            fdcId: Number(id),
            description:
              id === '912'
                ? 'Potatoes, boiled, cooked in skin, flesh'
                : 'Potatoes, raw, flesh and skin',
            dataType: 'Foundation',
            foodNutrients: [
              { amount: 87, nutrient: { name: 'Energy', unitName: 'KCAL' } },
              { amount: 1.9, nutrient: { name: 'Protein', unitName: 'G' } },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const foods = await enrichUsdaFoods({
      query: 'potato',
      config: limitedConfig,
      rateLimitKey: 'test:logical-enrichment-budget',
      policy: {
        metadataLimit: 8,
        detailWindow: 6,
        concurrency: 3,
        detailTimeoutMs: 1000,
        totalBudgetMs: 3000,
      },
    });

    expect(searchQueries).toEqual(['potato', 'cooked potato']);
    expect(foods.map((food) => food.sourceId)).toContain('912');

    await expect(
      searchUsdaFoods({
        query: 'another uncached food',
        config: limitedConfig,
        rateLimitKey: 'test:logical-enrichment-budget',
        metadataLimit: 8,
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('keeps USDA metadata relevance ordering instead of forcing data-type ordering', async () => {
    let searchBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        searchBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({ foods: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    await searchUsdaFoods({
      query: 'rice',
      config,
      rateLimitKey: 'test:metadata-relevance',
      metadataLimit: 15,
    });

    expect(searchBody).toMatchObject({ query: 'rice', pageSize: 15 });
    expect(searchBody).not.toHaveProperty('sortBy');
    expect(searchBody).not.toHaveProperty('sortOrder');
  });

  it('does not spend the one fallback query when two cooked rice metadata rows are viable', async () => {
    const searchQueries: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/foods/search')) {
          const body = JSON.parse(String(init?.body)) as { query: string };
          searchQueries.push(body.query);
          return new Response(
            JSON.stringify({
              foods: [
                {
                  fdcId: 920,
                  description: 'Rice, white, cooked',
                  dataType: 'Foundation',
                },
                {
                  fdcId: 921,
                  description: 'Rice, brown, cooked',
                  dataType: 'Foundation',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const id = requestUrl.match(/\/food\/(\d+)/)?.[1] ?? '920';
        return new Response(
          JSON.stringify({
            fdcId: Number(id),
            description:
              id === '921' ? 'Rice, brown, cooked' : 'Rice, white, cooked',
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

    await enrichUsdaFoods({
      query: 'rice',
      config,
      rateLimitKey: 'test:enough-cooked-rice',
      policy: {
        metadataLimit: 15,
        detailWindow: 6,
        concurrency: 3,
        detailTimeoutMs: 1000,
        totalBudgetMs: 3000,
      },
    });

    expect(searchQueries).toEqual(['rice']);
  });

  it('uses a cooked egg fallback for a plain eggs query', async () => {
    const searchQueries: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const requestUrl = String(url);
        if (requestUrl.includes('/foods/search')) {
          const body = JSON.parse(String(init?.body)) as { query: string };
          searchQueries.push(body.query);
          return new Response(JSON.stringify({ foods: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({}), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    await enrichUsdaFoods({
      query: 'eggs',
      config,
      rateLimitKey: 'test:cooked-eggs-fallback',
      policy: {
        metadataLimit: 15,
        detailWindow: 6,
        concurrency: 3,
        detailTimeoutMs: 1000,
        totalBudgetMs: 3000,
      },
    });

    expect(searchQueries).toEqual(['eggs', 'egg cooked']);
  });

  it('removes foreign-head composites before they consume USDA detail slots', () => {
    const ranked = rankUsdaSearchFoods('eggs', [
      {
        fdcId: 930,
        description: 'Bread, egg, toasted',
        dataType: 'Foundation',
        brandOwner: null,
        brandName: null,
        foodCategory: null,
      },
      {
        fdcId: 931,
        description: 'Egg, whole, cooked, scrambled',
        dataType: 'Foundation',
        brandOwner: null,
        brandName: null,
        foodCategory: null,
      },
    ]);

    expect(ranked.map((food) => food.fdcId)).toEqual([931]);
  });

  it('does not cache an empty USDA metadata response across a warm retry', async () => {
    let searchCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        searchCalls += 1;
        return new Response(
          JSON.stringify({
            foods:
              searchCalls === 1
                ? []
                : [
                    {
                      fdcId: 940,
                      description: 'Yogurt, Greek, plain',
                      dataType: 'Foundation',
                    },
                  ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const first = await searchUsdaFoods({
      query: 'Greek yogurt',
      config,
      rateLimitKey: 'test:empty-metadata-cache',
      metadataLimit: 15,
    });
    const second = await searchUsdaFoods({
      query: 'Greek yogurt',
      config,
      rateLimitKey: 'test:empty-metadata-cache',
      metadataLimit: 15,
    });

    expect(first).toEqual([]);
    expect(second.map((food) => food.fdcId)).toEqual([940]);
    expect(searchCalls).toBe(2);
  });
});
