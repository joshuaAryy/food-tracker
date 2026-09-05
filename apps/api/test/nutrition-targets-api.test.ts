import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { seedGoals, seedPreferences, seedProfile } from './helpers/seeds.js';

describe('nutrition target tracking-mode scope', () => {
  it('filters complex-only rows consistently for simple and complex users', async () => {
    await seedProfile();
    await seedGoals({ goalType: 'maintain', goalPace: null });
    await seedPreferences({ mode: 'simple' });

    const simple = await api.get('/api/v1/nutrition-targets').expect(200);
    expect(
      simple.body.data.targets.some(
        (target: { nutrientKey: string }) => target.nutrientKey === 'vitaminD',
      ),
    ).toBe(false);

    await prisma.trackingPreference.update({
      where: { userId: MOCK_USER_ID },
      data: { mode: 'complex' },
    });
    const complex = await api.get('/api/v1/nutrition-targets').expect(200);
    expect(
      complex.body.data.targets.some(
        (target: { nutrientKey: string }) => target.nutrientKey === 'vitaminD',
      ),
    ).toBe(true);
    expect(
      complex.body.data.targets.map(
        (target: { nutrientKey: string }) => target.nutrientKey,
      ),
    ).toContain('calories');
  });

  it('rejects a complex-only mutation from simple mode', async () => {
    await seedProfile();
    await seedGoals({ goalType: 'maintain', goalPace: null });
    await seedPreferences({ mode: 'simple' });

    const response = await api
      .put('/api/v1/nutrition-targets/vitaminD')
      .send({ value: 15 })
      .expect(404);
    expectErrorEnvelope(response.body, 'NOT_FOUND');
  });
});
