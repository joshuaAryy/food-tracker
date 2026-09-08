import type { RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  MOCK_USER_ID,
  setupPreviewResultSchema,
  setupResultSchema,
  type SetupInput,
} from '@food-tracker/shared';
import { createApp } from '../src/app.js';
import { calculatePersonalizedTargets } from '../src/lib/personalization.js';
import { prisma } from '../src/lib/prisma.js';

const authMiddleware: RequestHandler = (_request, response, next) => {
  response.locals.userId = MOCK_USER_ID;
  next();
};

const app = createApp(authMiddleware, {
  databaseReadiness: { ensureReady: async () => undefined },
});

const loseInput: SetupInput = {
  profile: {
    name: 'Contract Lose User',
    birthDate: '1990-06-15',
    sex: 'female',
    heightInches: 69,
    timezone: 'America/Toronto',
    startingWeightLb: 174,
    activityLevel: 'moderately_active',
    trainingStyle: 'weight_training',
  },
  goals: {
    goalType: 'lose',
    goalPace: 'moderate',
    targetWeightLb: 160,
  },
  preferences: {
    mode: 'complex',
    waterTrackingEnabled: true,
  },
};

const gainInput: SetupInput = {
  ...loseInput,
  profile: { ...loseInput.profile, name: 'Contract Gain User' },
  goals: {
    goalType: 'gain',
    goalPace: 'moderate_bulk',
    targetWeightLb: 185,
  },
};

const maintainInput: SetupInput = {
  ...loseInput,
  profile: { ...loseInput.profile, name: 'Contract Maintain User' },
  goals: {
    goalType: 'maintain',
    goalPace: null,
    targetWeightLb: 174,
  },
  preferences: {
    mode: 'simple',
    waterTrackingEnabled: false,
  },
};

function assertSchema<T>(
  value: unknown,
  schema: {
    safeParse(input: unknown): { success: boolean; data?: T; error?: unknown };
  },
): T {
  const parsed = schema.safeParse(value);
  expect(
    parsed.success,
    parsed.success ? undefined : JSON.stringify(parsed.error),
  ).toBe(true);
  return parsed.data as T;
}

function decimal(value: number | null): { toNumber(): number | null } | null {
  return value === null ? null : { toNumber: () => value };
}

describe('setup response contracts', () => {
  it.each([
    ['lose', loseInput],
    ['gain', gainInput],
  ] as const)(
    'returns a mobile-compatible %s preview response',
    async (_goal, input) => {
      const response = await request(app)
        .post('/api/v1/setup/preview')
        .send(input)
        .expect(200);

      expect(response.body.success).toBe(true);
      assertSchema(response.body.data, setupPreviewResultSchema);
      expect(response.body.data.ratePlanning).toMatchObject(
        _goal === 'lose'
          ? {
              minimumRateLbPerWeek: 0.5,
              maximumRateLbPerWeek: 2,
            }
          : {
              minimumRateLbPerWeek: 0.5,
              maximumRateLbPerWeek: 2,
            },
      );
    },
  );

  it('preserves an explicit policy-valid preview rate separately from feasibility', async () => {
    const response = await request(app)
      .post('/api/v1/setup/preview')
      .send({
        ...loseInput,
        goals: { ...loseInput.goals, targetRateLbPerWeek: 1.15 },
      })
      .expect(200);

    assertSchema(response.body.data, setupPreviewResultSchema);
    expect(response.body.data.calculatedTargets.targetRateLbPerWeek).toBe(1.15);
    expect(response.body.data.ratePlanning).toMatchObject({
      minimumRateLbPerWeek: 0.5,
      maximumRateLbPerWeek: 2,
      selectedRateLbPerWeek: 1.15,
    });
  });

  it('returns an available rate plan for an under-19 Lose preview', async () => {
    const response = await request(app)
      .post('/api/v1/setup/preview')
      .send({
        ...loseInput,
        profile: { ...loseInput.profile, birthDate: '2012-08-29' },
        goals: { ...loseInput.goals, targetRateLbPerWeek: 0.75 },
      })
      .expect(200);

    const data = assertSchema(response.body.data, setupPreviewResultSchema);
    expect(data.ratePlanning).toMatchObject({
      status: 'available',
      minimumRateLbPerWeek: 0.5,
      maximumRateLbPerWeek: 2,
      selectedRateLbPerWeek: 0.75,
    });
  });

  it('returns a mobile-compatible Maintain setup response', async () => {
    const calculated = calculatePersonalizedTargets(maintainInput);
    const profileRow = {
      userId: MOCK_USER_ID,
      name: maintainInput.profile.name,
      age: calculated.age,
      birthDate: new Date(`${maintainInput.profile.birthDate}T00:00:00.000Z`),
      sex: maintainInput.profile.sex,
      heightInches: maintainInput.profile.heightInches,
      timezone: maintainInput.profile.timezone,
      startingWeightLb: decimal(maintainInput.profile.startingWeightLb),
      activityLevel: maintainInput.profile.activityLevel,
      trainingStyle: maintainInput.profile.trainingStyle,
    };
    const goalsRow = {
      userId: MOCK_USER_ID,
      goalType: maintainInput.goals.goalType,
      goalPace: maintainInput.goals.goalPace,
      targetRateLbPerWeek: decimal(calculated.targetRateLbPerWeek),
      targetWeightLb: decimal(maintainInput.goals.targetWeightLb),
      targetCalories: calculated.targetCalories,
      targetProteinGrams: decimal(calculated.targetProteinGrams),
      targetCarbsGrams: decimal(calculated.targetCarbsGrams),
      targetFatGrams: decimal(calculated.targetFatGrams),
      targetFiberGrams: decimal(calculated.targetFiberGrams),
      limitSugarGrams: decimal(calculated.limitSugarGrams),
      limitSodiumMg: calculated.limitSodiumMg,
    };
    const preferencesRow = {
      userId: MOCK_USER_ID,
      mode: maintainInput.preferences.mode,
      waterTrackingEnabled: maintainInput.preferences.waterTrackingEnabled,
      dailyWaterGoalMl: 2000,
    };

    const profileUpsert = vi
      .spyOn(prisma.userProfile, 'upsert')
      .mockResolvedValue(profileRow as never);
    const goalsUpsert = vi
      .spyOn(prisma.userGoal, 'upsert')
      .mockResolvedValue(goalsRow as never);
    const preferencesUpsert = vi
      .spyOn(prisma.trackingPreference, 'upsert')
      .mockResolvedValue(preferencesRow as never);
    const transaction = vi
      .spyOn(prisma, '$transaction')
      .mockResolvedValue([profileRow, goalsRow, preferencesRow] as never);

    try {
      const response = await request(app)
        .put('/api/v1/setup')
        .send(maintainInput)
        .expect(200);

      expect(response.body.success).toBe(true);
      assertSchema(response.body.data, setupResultSchema);
      expect(response.body.data.goals.targetRateLbPerWeek).toBeNull();
      expect(profileUpsert).toHaveBeenCalledOnce();
      expect(goalsUpsert).toHaveBeenCalledOnce();
      expect(preferencesUpsert).toHaveBeenCalledOnce();
      expect(transaction).toHaveBeenCalledOnce();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
