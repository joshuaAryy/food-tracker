import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './helpers/api.js';

describe('AI serving suggestions', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.AI_FOOD_PARSE_RATE_LIMIT_MAX = '100';
    process.env.AI_FOOD_PARSE_RATE_LIMIT_WINDOW = '600000';
    process.env.AI_FOOD_PARSE_DAILY_LIMIT = '100';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it('attaches deterministic serving suggestions while preserving raw AI fields', async () => {
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
                              name: 'eggs',
                              quantityText: '2',
                              servingText: '2 eggs',
                            },
                            {
                              name: 'toast',
                              quantityText: null,
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
      .post('/api/v1/ai/food-parse')
      .send({ description: '2 eggs and toast' })
      .expect(200);

    expect(response.body.data.items).toMatchObject([
      {
        quantityText: '2',
        servingText: '2 eggs',
        servingSuggestion: {
          status: 'parsed',
          quantity: 2,
          unit: 'egg',
          rawQuantityText: '2',
          rawServingText: '2 eggs',
        },
      },
      {
        quantityText: null,
        servingText: null,
        servingSuggestion: {
          status: 'missing',
          reason: 'no_explicit_serving',
        },
      },
    ]);
  });
});
