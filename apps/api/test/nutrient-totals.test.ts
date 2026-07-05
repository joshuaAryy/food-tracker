import { describe, expect, it } from 'vitest';
import { api, expectSuccessEnvelope } from './helpers/api.js';

const loggedAt = '2026-06-15T17:00:00.000Z';

interface NutrientTotalsResponseBody {
  date: string;
  nutrients: Record<string, { amount: number; unit: string }>;
}

describe('daily nutrient totals API', () => {
  it('combines column-backed and normalized nutrient totals without filling missing nutrients with zero', async () => {
    await api
      .post('/api/v1/food-logs')
      .send({
        foodName: 'Coffee yogurt',
        mealType: 'breakfast',
        calories: 200,
        protein: 20,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        loggedAt,
        nutrients: {
          caffeine: { amount: 95, unit: 'mg' },
          vitaminC: { amount: 60, unit: 'mg' },
        },
      })
      .expect(200);
    await api
      .post('/api/v1/food-logs')
      .send({
        foodName: 'Tea',
        mealType: 'snack',
        calories: 5,
        protein: 0,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        loggedAt,
        nutrients: {
          caffeine: { amount: 45, unit: 'mg' },
        },
      })
      .expect(200);

    const response = await api
      .get('/api/v1/analytics/nutrients/daily')
      .query({ date: '2026-06-15' })
      .expect(200);

    expectSuccessEnvelope(response.body);
    const data = response.body.data as NutrientTotalsResponseBody;
    expect(response.body.data).toEqual({
      date: '2026-06-15',
      nutrients: {
        calories: { amount: 205, unit: 'kcal' },
        protein: { amount: 20, unit: 'g' },
        caffeine: { amount: 140, unit: 'mg' },
        vitaminC: { amount: 60, unit: 'mg' },
      },
    });
    expect(data.nutrients.carbs).toBeUndefined();
    expect(data.nutrients.sodium).toBeUndefined();
  });
});
