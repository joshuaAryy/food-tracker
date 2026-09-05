import { MOCK_USER_ID } from '@food-tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  api,
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './helpers/api.js';
import { seedGoals, seedPreferences, seedProfile } from './helpers/seeds.js';

describe('profile API', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current user profile', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T12:00:00.000Z'));
    await seedProfile({ startingWeightLb: 185.5 });

    const response = await api.get('/api/v1/profile').expect(200);

    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual({
      name: 'Test User',
      age: 31,
      birthDate: '1995-01-01',
      sex: 'male',
      heightInches: 70,
      timezone: 'America/Toronto',
      startingWeightLb: 185.5,
      activityLevel: 'moderately_active',
      trainingStyle: 'mixed',
    });
  });

  it('updates and persists the current user profile', async () => {
    const input = {
      name: 'Updated User',
      birthDate: '1993-02-03',
      sex: 'female',
      heightInches: 66,
      timezone: 'America/Vancouver',
      startingWeightLb: 142.34,
      activityLevel: 'lightly_active',
      trainingStyle: 'cardio',
    };

    const response = await api.put('/api/v1/profile').send(input).expect(200);
    const persisted = await prisma.userProfile.findUnique({
      where: { userId: MOCK_USER_ID },
    });

    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual({
      ...input,
      age: 33,
      startingWeightLb: 142.3,
    });
    expect(persisted?.timezone).toBe('America/Vancouver');
    expect(persisted?.startingWeightLb?.toNumber()).toBe(142.3);
    expect(persisted?.birthDate?.toISOString().slice(0, 10)).toBe('1993-02-03');
  });

  it('rejects an independently submitted age field', async () => {
    const response = await api
      .put('/api/v1/profile')
      .send({
        name: 'Updated User',
        age: 33,
        birthDate: '1993-02-03',
        sex: 'female',
        heightInches: 66,
        timezone: 'America/Vancouver',
        startingWeightLb: 142.34,
        activityLevel: 'lightly_active',
        trainingStyle: 'cardio',
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('rejects an invalid profile body', async () => {
    const response = await api
      .put('/api/v1/profile')
      .send({
        name: '',
        age: -1,
        birthDate: 'not-a-date',
        sex: '',
        heightInches: 0,
        timezone: 'Not/A_Timezone',
        startingWeightLb: -10,
        activityLevel: 'invalid',
        trainingStyle: 'invalid',
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
    expect(
      await prisma.userProfile.findUnique({
        where: { userId: MOCK_USER_ID },
      }),
    ).toBeNull();
  });
});

describe('goals API', () => {
  it('returns the current user goals', async () => {
    await seedGoals({
      goalType: 'maintain',
      goalPace: null,
      targetRateLbPerWeek: null,
      targetCalories: 2400,
    });

    const response = await api.get('/api/v1/goals').expect(200);

    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual({
      goalType: 'maintain',
      goalPace: null,
      targetRateLbPerWeek: null,
      targetWeightLb: 190,
      targetCalories: 2400,
      targetProteinGrams: 150,
      targetCarbsGrams: null,
      targetFatGrams: null,
      targetFiberGrams: null,
      limitSugarGrams: null,
      limitSodiumMg: null,
    });
  });

  it('updates and persists goals', async () => {
    const input = {
      goalType: 'lose',
      goalPace: 'moderate' as const,
      targetWeightLb: 170.04,
      targetCalories: 2100,
      targetProteinGrams: 160.06,
    };

    const response = await api.put('/api/v1/goals').send(input).expect(200);
    const persisted = await prisma.userGoal.findUnique({
      where: { userId: MOCK_USER_ID },
    });

    expect(response.body.data).toEqual({
      ...input,
      targetWeightLb: 170,
      targetProteinGrams: 160.1,
      targetRateLbPerWeek: null,
      targetCarbsGrams: null,
      targetFatGrams: null,
      targetFiberGrams: null,
      limitSugarGrams: null,
      limitSodiumMg: null,
    });
    expect(persisted?.goalType).toBe('lose');
    expect(persisted?.targetCalories).toBe(2100);
  });

  it('accepts explicit nutrient goal overrides', async () => {
    const response = await api
      .put('/api/v1/goals')
      .send({
        goalType: 'maintain',
        goalPace: null,
        targetWeightLb: 190,
        targetCalories: 2200,
        targetProteinGrams: 150,
        targetCarbsGrams: 210,
        targetFatGrams: 75,
        targetFiberGrams: 32,
        limitSugarGrams: 45,
        limitSodiumMg: 1800,
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      targetCarbsGrams: 210,
      targetFatGrams: 75,
      targetFiberGrams: 32,
      limitSugarGrams: 45,
      limitSodiumMg: 1800,
    });
  });

  it('isolates field-level target override intent', async () => {
    await seedProfile();

    await api
      .put('/api/v1/goals')
      .send({
        goalType: 'maintain',
        goalPace: null,
        targetWeightLb: 180,
        targetCalories: 2300,
        targetProteinGrams: 150,
        targetOverrideFields: ['calories'],
      })
      .expect(200);

    const overrides = await prisma.userNutrientTargetOverride.findMany({
      where: { userId: MOCK_USER_ID },
      orderBy: { nutrientKey: 'asc' },
    });
    expect(overrides.map((override) => override.nutrientKey)).toEqual([
      'calories',
    ]);
  });

  it('persists the effective safe rate rather than the requested rate', async () => {
    await seedProfile({ startingWeightLb: 180 });

    const response = await api
      .put('/api/v1/goals')
      .send({
        goalType: 'lose',
        goalPace: 'aggressive',
        targetWeightLb: 160,
        targetRateLbPerWeek: 2,
        targetCalories: 2100,
        targetProteinGrams: 150,
        targetOverrideFields: [],
      })
      .expect(200);

    const persisted = await prisma.userGoal.findUnique({
      where: { userId: MOCK_USER_ID },
    });
    expect(persisted?.targetRateLbPerWeek?.toNumber()).toBe(
      response.body.data.targetRateLbPerWeek,
    );
    expect(response.body.data.targetRateLbPerWeek).toBeLessThan(2);
  });

  it('rejects an invalid goal type', async () => {
    const response = await api
      .put('/api/v1/goals')
      .send({
        goalType: 'bulk',
        goalPace: null,
        targetWeightLb: 190,
        targetCalories: 3000,
        targetProteinGrams: 150,
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('rejects negative targets', async () => {
    const response = await api
      .put('/api/v1/goals')
      .send({
        goalType: 'gain',
        goalPace: 'moderate_bulk',
        targetWeightLb: -1,
        targetCalories: -1,
        targetProteinGrams: -1,
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });
});

describe('tracking preferences API', () => {
  it('returns tracking preferences', async () => {
    await seedPreferences({ mode: 'complex', waterTrackingEnabled: true });

    const response = await api.get('/api/v1/tracking-preferences').expect(200);

    expect(response.body.data).toEqual({
      mode: 'complex',
      waterTrackingEnabled: true,
      dailyWaterGoalMl: 2000,
    });
  });

  it('updates and persists tracking preferences', async () => {
    const response = await api
      .put('/api/v1/tracking-preferences')
      .send({ mode: 'simple', waterTrackingEnabled: true })
      .expect(200);
    const persisted = await prisma.trackingPreference.findUnique({
      where: { userId: MOCK_USER_ID },
    });

    expect(response.body.data).toEqual({
      mode: 'simple',
      waterTrackingEnabled: true,
      dailyWaterGoalMl: 2000,
    });
    expect(persisted?.waterTrackingEnabled).toBe(true);
  });

  it('rejects an invalid tracking mode', async () => {
    const response = await api
      .put('/api/v1/tracking-preferences')
      .send({ mode: 'expert', waterTrackingEnabled: false })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });
});
