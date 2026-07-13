import { PHOTO_ANALYSIS_MAX_BYTES } from '@food-tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

async function createTrustedFood(name: string) {
  return prisma.foodItem.create({
    data: {
      name,
      normalizedName: name.toLocaleLowerCase(),
      searchText: name.toLocaleLowerCase(),
      sourceType: 'app_owned',
      foodType: 'generic',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      calories: 165,
      protein: 31,
    },
  });
}

describe('photo food analysis API', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = 'mock';
    process.env.PHOTO_ANALYSIS_RATE_LIMIT_MAX = '100';
    process.env.PHOTO_ANALYSIS_DAILY_LIMIT = '100';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
    delete process.env.PHOTO_ANALYSIS_RATE_LIMIT_MAX;
    delete process.env.PHOTO_ANALYSIS_DAILY_LIMIT;
  });

  it('rejects unsupported content types before invoking the provider', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'application/octet-stream')
      .send(jpeg)
      .expect(415);

    expectErrorEnvelope(response.body, 'UNSUPPORTED_IMAGE_TYPE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing content type before invoking the provider', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .send(jpeg)
      .expect(415);

    expectErrorEnvelope(response.body, 'UNSUPPORTED_IMAGE_TYPE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty or invalid JPEG before invoking the provider', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(Buffer.from([0x00, 0x01, 0x02]))
      .expect(400);

    expectErrorEnvelope(response.body, 'INVALID_IMAGE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects one byte over the exact five MiB upload limit', async () => {
    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(Buffer.concat([jpeg, Buffer.alloc(PHOTO_ANALYSIS_MAX_BYTES)]))
      .expect(413);

    expectErrorEnvelope(response.body, 'IMAGE_TOO_LARGE');
  });

  it('accepts the exact five MiB boundary before provider processing', async () => {
    process.env.AI_PROVIDER = 'disabled';

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(
        Buffer.concat([
          jpeg,
          Buffer.alloc(PHOTO_ANALYSIS_MAX_BYTES - jpeg.length),
        ]),
      )
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
  });

  it('returns independent review rows without writing FoodItems or FoodLogs', async () => {
    const before = {
      foodItems: await prisma.foodItem.count(),
      foodLogs: await prisma.foodLog.count(),
    };

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data).toMatchObject({
      status: 'recognized',
      items: [
        expect.objectContaining({
          id: 'photo-item-1',
          recognizedName: expect.any(String),
          candidates: expect.any(Array),
          selectedCandidateId: null,
          loggable: false,
        }),
      ],
    });
    expect(response.body.data.items[0]).not.toHaveProperty('nutrition');
    expect(response.body.data.items[0]).not.toHaveProperty('providerPayload');
    expect(await prisma.foodItem.count()).toBe(before.foodItems);
    expect(await prisma.foodLog.count()).toBe(before.foodLogs);
  });

  it('sends only the normalized JPEG to Gemini and rejects nutrition-bearing output', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    let captured: { body: Record<string, unknown>; headers: Headers } | null =
      null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        captured = {
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
          headers: new Headers(init?.headers),
        };
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
                            name: 'chicken',
                            identityConfidence: 'high',
                            portionConfidence: 'medium',
                            quantityText: '150',
                            servingText: '150 g',
                            calories: 300,
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

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
    expect(captured).not.toBeNull();
    const capturedRequest = captured as unknown as {
      body: Record<string, unknown>;
      headers: Headers;
    };
    expect(capturedRequest.headers.get('x-goog-api-key')).toBe('test-key');
    const contents = capturedRequest.body.contents as {
      parts: Record<string, unknown>[];
    }[];
    expect(contents[0]?.parts[0]).toMatchObject({
      inline_data: {
        mime_type: 'image/jpeg',
        data: jpeg.toString('base64'),
      },
    });
    expect(contents[0]?.parts[1]?.text).toEqual(
      expect.stringContaining('Do not return calories'),
    );
  });

  it('rejects invalid provisional quantities and unknown provider fields', async () => {
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
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              portionConfidence: 'high',
                              quantityText: '-1 g',
                              servingText: null,
                              unknown: true,
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
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
  });

  it('rejects more than eight provider recognition rows', async () => {
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
                          items: Array.from({ length: 9 }, (_, index) => ({
                            name: `food ${index + 1}`,
                            identityConfidence: 'low',
                            portionConfidence: null,
                          })),
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
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
  });

  it('returns no_food_detected without writing when the provider finds nothing', async () => {
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
                  content: { parts: [{ text: JSON.stringify({ items: [] }) }] },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data).toEqual({
      status: 'no_food_detected',
      items: [],
    });
    expect(await prisma.foodItem.count()).toBe(0);
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('keeps low identity confidence unresolved even when a trusted candidate exists', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');
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
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'low',
                              portionConfidence: 'medium',
                              quantityText: '150 g',
                              servingText: null,
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
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      identityConfidence: 'low',
      selectedCandidateId: null,
      loggable: false,
      unresolvedReason: 'low_identity_confidence',
    });
  });

  it('marks an unsupported visual household portion as needs_review', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');
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
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              portionConfidence: 'low',
                              quantityText: '1 cup',
                              servingText: null,
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
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      selectedCandidateId: expect.any(String),
      loggable: false,
      unresolvedReason: 'portion_needs_review',
      provisionalPortion: { servingResolution: 'needs_review' },
    });
  });

  it('returns multiple independently ranked foods with a supported provisional serving', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');
    await createTrustedFood('rice');

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
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              portionConfidence: 'medium',
                              quantityText: '150',
                              servingText: '150 g',
                            },
                            {
                              name: 'rice',
                              identityConfidence: 'medium',
                              portionConfidence: 'low',
                              quantityText: '150 g',
                              servingText: null,
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
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.status).toBe('recognized');
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toMatchObject({
      id: 'photo-item-1',
      recognizedName: 'chicken',
      selectedCandidateId: expect.any(String),
      loggable: true,
      provisionalPortion: {
        servingResolution: 'supported',
        parsed: { status: 'parsed', quantity: 150, unit: 'g' },
      },
    });
    expect(response.body.data.items[1]).toMatchObject({
      id: 'photo-item-2',
      recognizedName: 'rice',
      provisionalPortion: { servingResolution: 'needs_review' },
    });
    expect(response.body.data.items[0]).not.toHaveProperty('calories');
    expect(response.body.data.items[0].candidates[0]).toHaveProperty(
      'confidence',
    );
  });

  it('keeps returned trusted candidate references compatible with authoritative saving', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');

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
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              portionConfidence: 'medium',
                              quantityText: '150 g',
                              servingText: null,
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
          ),
      ),
    );

    const analysis = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);
    const foodItemId = analysis.body.data.items[0]
      .selectedCandidateId as string;

    const save = await api
      .post('/api/v1/food-logs/from-candidates')
      .send({
        mealType: 'lunch',
        loggedAt: new Date().toISOString(),
        items: [
          {
            candidateType: 'food_item',
            foodItemId,
            serving: { quantity: 150, unit: 'g' },
          },
        ],
      })
      .expect(200);

    expect(save.body.data.foodLogs).toHaveLength(1);
    expect(save.body.data.foodLogs[0]).toMatchObject({
      foodItemId,
      calories: 248,
    });
    expect(await prisma.foodLog.count()).toBe(1);
  });

  it('keeps duplicate recognition rows unresolved instead of auto-selecting both', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');

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
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              portionConfidence: 'medium',
                              quantityText: '150 g',
                              servingText: null,
                            },
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              portionConfidence: 'medium',
                              quantityText: '150 g',
                              servingText: null,
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
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.items[0].loggable).toBe(true);
    expect(response.body.data.items[1]).toMatchObject({
      selectedCandidateId: null,
      loggable: false,
      unresolvedReason: 'ambiguous_identity',
    });
  });
});
