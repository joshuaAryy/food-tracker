import { describe, expect, it } from 'vitest';
import { MOCK_USER_ID } from '@food-tracker/shared';
import { computeInsightsOverview } from '../src/modules/analytics/trends/overview.js';
import { createTrendRequestContext } from '../src/modules/analytics/trends/service.js';
import { prisma } from '../src/lib/prisma.js';
import { seedPreferences, seedProfile } from './helpers/seeds.js';

describe('optional analytics failure isolation', () => {
  it('keeps the Weight base facts when forecast computation fails', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    await prisma.weightLog.create({
      data: {
        userId: MOCK_USER_ID,
        weightLb: 170,
        loggedAt: new Date(),
      },
    });

    const context = createTrendRequestContext(MOCK_USER_ID, [
      'calories',
      'protein',
      'carbs',
      'fat',
      'macroComposition',
      'weight',
      'hydration',
      'loggingConsistency',
    ]);
    const result = await computeInsightsOverview(
      MOCK_USER_ID,
      'week',
      context,
      {
        computeWeightForecast: () => {
          throw new Error('forecast unavailable');
        },
      },
    );

    expect(result.weight).toMatchObject({
      status: 'available',
      data: {
        current: 170,
        forecast: { status: 'failed', code: 'section_unavailable' },
      },
    });
  });

  it('keeps healthy overview groups when the nutrient highlight group fails', async () => {
    await seedProfile();
    await seedPreferences({ mode: 'complex' });
    const context = createTrendRequestContext(MOCK_USER_ID, [
      'calories',
      'protein',
      'carbs',
      'fat',
      'macroComposition',
      'weight',
      'hydration',
      'loggingConsistency',
    ]);
    const result = await computeInsightsOverview(
      MOCK_USER_ID,
      'week',
      context,
      { computeNutrientHighlights: async () => { throw new Error('nutrient detail unavailable'); } },
    );

    expect(result.nutrientHighlights.status).toBe('failed');
    expect(result.energy.status).toBe('available');
    expect(result.hydration.status).toBe('available');
  });
});
