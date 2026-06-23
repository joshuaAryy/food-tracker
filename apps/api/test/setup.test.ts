import { MOCK_USER_ID, type SetupInput } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  api,
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './helpers/api.js';
import { seedPreferences, seedProfile } from './helpers/seeds.js';

const setupInput: SetupInput = {
  profile: {
    name: 'Taylor Example',
    birthDate: '1994-06-15',
    sex: 'female',
    heightInches: 69,
    timezone: 'America/Toronto',
    startingWeightLb: 174.26,
    activityLevel: 'moderately_active' as const,
    trainingStyle: 'weight_training' as const,
  },
  goals: {
    goalType: 'lose' as const,
    goalPace: 'moderate' as const,
    targetWeightLb: 172.04,
  },
  preferences: {
    mode: 'complex' as const,
    waterTrackingEnabled: true,
  },
};

function expectedAge(birthDate: string): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - Number(year);
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  if (
    currentMonth < Number(month) ||
    (currentMonth === Number(month) && currentDay < Number(day))
  ) {
    age -= 1;
  }

  return age;
}

async function preview(input: typeof setupInput = setupInput) {
  const response = await api
    .post('/api/v1/setup/preview')
    .send(input)
    .expect(200);

  return response.body.data as {
    age: number;
    calculatedTargets: {
      targetCalories: number;
      targetProteinGrams: number;
    };
  };
}

describe('setup API', () => {
  it('reports missing, partial, and complete setup state', async () => {
    const missing = await api.get('/api/v1/setup/status').expect(200);
    expect(missing.body.data).toEqual({
      profileComplete: false,
      goalsComplete: false,
      preferencesComplete: false,
      isComplete: false,
    });

    await seedProfile();
    const partial = await api.get('/api/v1/setup/status').expect(200);
    expect(partial.body.data).toEqual({
      profileComplete: true,
      goalsComplete: false,
      preferencesComplete: false,
      isComplete: false,
    });

    await prisma.userGoal.create({
      data: {
        userId: MOCK_USER_ID,
        goalType: 'maintain',
        goalPace: null,
        targetWeightLb: 180,
        targetCalories: 2200,
        targetProteinGrams: 130,
      },
    });
    await seedPreferences();

    const complete = await api.get('/api/v1/setup/status').expect(200);
    expect(complete.body.data).toEqual({
      profileComplete: true,
      goalsComplete: true,
      preferencesComplete: true,
      isComplete: true,
    });
  });

  it('does not treat legacy rows with missing required values as complete', async () => {
    await prisma.userProfile.create({
      data: {
        userId: MOCK_USER_ID,
        timezone: 'America/Toronto',
      },
    });
    await prisma.userGoal.create({
      data: {
        userId: MOCK_USER_ID,
        goalType: 'maintain',
      },
    });
    await seedPreferences();

    const status = await api.get('/api/v1/setup/status').expect(200);
    expect(status.body.data).toEqual({
      profileComplete: false,
      goalsComplete: false,
      preferencesComplete: true,
      isComplete: false,
    });

    expectErrorEnvelope(
      (await api.get('/api/v1/profile').expect(404)).body,
      'NOT_FOUND',
    );
    expectErrorEnvelope(
      (await api.get('/api/v1/goals').expect(404)).body,
      'NOT_FOUND',
    );
  });

  it('saves profile, goals, and preferences atomically', async () => {
    const response = await api
      .put('/api/v1/setup')
      .send(setupInput)
      .expect(200);
    const body = response.body as {
      data: {
        calculatedTargets: {
          targetCalories: number;
          targetProteinGrams: number;
        };
      };
    };

    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual({
      profile: {
        ...setupInput.profile,
        age: expect.any(Number),
        startingWeightLb: 174.3,
      },
      goals: {
        ...setupInput.goals,
        targetWeightLb: 172,
        targetCalories: expect.any(Number),
        targetProteinGrams: expect.any(Number),
      },
      preferences: setupInput.preferences,
      calculatedTargets: {
        targetCalories: expect.any(Number),
        targetProteinGrams: expect.any(Number),
      },
      status: {
        profileComplete: true,
        goalsComplete: true,
        preferencesComplete: true,
        isComplete: true,
      },
    });

    const [profile, goals, preferences] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: MOCK_USER_ID } }),
      prisma.userGoal.findUnique({ where: { userId: MOCK_USER_ID } }),
      prisma.trackingPreference.findUnique({
        where: { userId: MOCK_USER_ID },
      }),
    ]);
    expect(profile?.startingWeightLb?.toNumber()).toBe(174.3);
    expect(profile?.name).toBe('Taylor Example');
    expect(profile?.birthDate?.toISOString().slice(0, 10)).toBe('1994-06-15');
    expect(profile?.activityLevel).toBe('moderately_active');
    expect(profile?.trainingStyle).toBe('weight_training');
    expect(goals?.goalPace).toBe('moderate');
    expect(goals?.targetCalories).toBe(
      body.data.calculatedTargets.targetCalories,
    );
    expect(goals?.targetProteinGrams?.toNumber()).toBe(
      body.data.calculatedTargets.targetProteinGrams,
    );
    expect(preferences?.waterTrackingEnabled).toBe(true);
  });

  it('previews calculated targets without writing setup rows', async () => {
    const result = await preview();

    expect(result).toEqual({
      age: expectedAge(setupInput.profile.birthDate),
      calculatedTargets: {
        targetCalories: expect.any(Number),
        targetProteinGrams: expect.any(Number),
      },
    });
    expect(
      await Promise.all([
        prisma.userProfile.findUnique({ where: { userId: MOCK_USER_ID } }),
        prisma.userGoal.findUnique({ where: { userId: MOCK_USER_ID } }),
        prisma.trackingPreference.findUnique({
          where: { userId: MOCK_USER_ID },
        }),
      ]),
    ).toEqual([null, null, null]);
  });

  it('rejects arbitrary sex values because sex affects target calculation', async () => {
    const response = await api
      .post('/api/v1/setup/preview')
      .send({
        ...setupInput,
        profile: {
          ...setupInput.profile,
          sex: 'prefer_not_to_say',
        },
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('calculates different calorie targets for male and female inputs', async () => {
    const female = await preview({
      ...setupInput,
      profile: { ...setupInput.profile, sex: 'female' },
    });
    const male = await preview({
      ...setupInput,
      profile: { ...setupInput.profile, sex: 'male' },
    });

    expect(male.calculatedTargets.targetCalories).toBeGreaterThan(
      female.calculatedTargets.targetCalories,
    );
  });

  it('uses birthday to derive age', async () => {
    const result = await preview({
      ...setupInput,
      profile: {
        ...setupInput.profile,
        birthDate: '2000-01-01',
      },
    });

    expect(result.age).toBe(expectedAge('2000-01-01'));
  });

  it('increases calorie targets for higher activity levels', async () => {
    const sedentary = await preview({
      ...setupInput,
      profile: { ...setupInput.profile, activityLevel: 'sedentary' },
    });
    const athlete = await preview({
      ...setupInput,
      profile: { ...setupInput.profile, activityLevel: 'athlete' },
    });

    expect(athlete.calculatedTargets.targetCalories).toBeGreaterThan(
      sedentary.calculatedTargets.targetCalories,
    );
  });

  it('adjusts calorie targets by goal pace', async () => {
    const slowLoss = await preview({
      ...setupInput,
      goals: { ...setupInput.goals, goalType: 'lose', goalPace: 'slow' },
    });
    const aggressiveLoss = await preview({
      ...setupInput,
      goals: {
        ...setupInput.goals,
        goalType: 'lose',
        goalPace: 'aggressive',
      },
    });
    const aggressiveGain = await preview({
      ...setupInput,
      goals: {
        ...setupInput.goals,
        goalType: 'gain',
        goalPace: 'aggressive_bulk',
      },
    });

    expect(slowLoss.calculatedTargets.targetCalories).toBeGreaterThan(
      aggressiveLoss.calculatedTargets.targetCalories,
    );
    expect(aggressiveGain.calculatedTargets.targetCalories).toBeGreaterThan(
      slowLoss.calculatedTargets.targetCalories,
    );
  });

  it('increases protein targets for training and fat-loss contexts', async () => {
    const sedentaryMaintenance = await preview({
      ...setupInput,
      profile: {
        ...setupInput.profile,
        activityLevel: 'sedentary',
        trainingStyle: 'none',
      },
      goals: {
        ...setupInput.goals,
        goalType: 'maintain',
        goalPace: null,
      },
    });
    const athleteLoss = await preview({
      ...setupInput,
      profile: {
        ...setupInput.profile,
        activityLevel: 'athlete',
        trainingStyle: 'athlete',
      },
      goals: {
        ...setupInput.goals,
        goalType: 'lose',
        goalPace: 'moderate',
      },
    });

    expect(athleteLoss.calculatedTargets.targetProteinGrams).toBeGreaterThan(
      sedentaryMaintenance.calculatedTargets.targetProteinGrams,
    );
  });

  it('updates setup without clearing an explicitly preserved preference', async () => {
    await seedPreferences({
      mode: 'simple',
      waterTrackingEnabled: true,
    });

    const response = await api
      .put('/api/v1/setup')
      .send({
        ...setupInput,
        preferences: {
          mode: 'complex',
          waterTrackingEnabled: true,
        },
      })
      .expect(200);

    expect(response.body.data.preferences).toEqual({
      mode: 'complex',
      waterTrackingEnabled: true,
    });
    expect(
      await prisma.trackingPreference.findUnique({
        where: { userId: MOCK_USER_ID },
      }),
    ).toMatchObject({
      mode: 'complex',
      waterTrackingEnabled: true,
    });
  });

  it('rejects invalid setup without writing any section', async () => {
    const response = await api
      .put('/api/v1/setup')
      .send({
        ...setupInput,
        goals: {
          ...setupInput.goals,
          goalPace: 'lean_bulk',
        },
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
    expect(
      await Promise.all([
        prisma.userProfile.findUnique({ where: { userId: MOCK_USER_ID } }),
        prisma.userGoal.findUnique({ where: { userId: MOCK_USER_ID } }),
        prisma.trackingPreference.findUnique({
          where: { userId: MOCK_USER_ID },
        }),
      ]),
    ).toEqual([null, null, null]);
  });
});
