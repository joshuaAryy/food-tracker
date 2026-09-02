import { MOCK_USER_ID } from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, expectErrorEnvelope } from './helpers/api.js';
import { recentLocalDateTime } from './helpers/dates.js';
import { computeRecommendationFacts } from '../src/modules/analytics/recommendation-facts.js';
import {
  seedGoals,
  seedProfile,
  seedRecentWeight,
  seedSevenFoodDays,
} from './helpers/seeds.js';

interface RecommendationBody {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  sourceFacts: Record<string, unknown>;
  status: string;
}

function recommendations(responseBody: {
  data: { recommendations: RecommendationBody[] };
}): RecommendationBody[] {
  return responseBody.data.recommendations;
}

function recommendationOfType(
  responseBody: { data: { recommendations: RecommendationBody[] } },
  type: string,
): RecommendationBody {
  const recommendation = recommendations(responseBody).find(
    (item) => item.type === type,
  );

  if (recommendation === undefined) {
    throw new Error(`Expected recommendation type ${type}`);
  }

  return recommendation;
}

async function seedCompleteTracking(input: {
  goalType: 'lose' | 'maintain' | 'gain';
  targetCalories: number;
  targetProteinGrams: number;
  calories: number;
  protein: number;
}): Promise<void> {
  await seedProfile();
  await seedGoals({
    goalType: input.goalType,
    targetCalories: input.targetCalories,
    targetProteinGrams: input.targetProteinGrams,
  });
  await seedSevenFoodDays({
    calories: input.calories,
    protein: input.protein,
  });
  await seedRecentWeight();
}

describe('recommendation generation', () => {
  it('generates protein_low with deterministic facts and wording', async () => {
    await seedCompleteTracking({
      goalType: 'gain',
      targetCalories: 2000,
      targetProteinGrams: 150,
      calories: 2000,
      protein: 115,
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const item = recommendationOfType(response.body, 'protein_low');

    expect(item).toMatchObject({
      type: 'protein_low',
      severity: 'medium',
      title: 'Protein is below target',
      message:
        'You are averaging 35g below your protein target over the last 7 days.',
      sourceFacts: {
        targetProteinGrams: 150,
        averageProteinGrams: 115,
        differenceGrams: 35,
        daysAnalyzed: 7,
      },
      status: 'active',
    });
  });

  it('generates calories_under_target for a gain goal', async () => {
    await seedCompleteTracking({
      goalType: 'gain',
      targetCalories: 3000,
      targetProteinGrams: 100,
      calories: 2500,
      protein: 100,
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const item = recommendationOfType(response.body, 'calories_under_target');

    expect(item).toMatchObject({
      severity: 'medium',
      title: 'Calories are below target',
      sourceFacts: {
        targetCalories: 3000,
        averageCalories: 2500,
        differenceCalories: 500,
        goalType: 'gain',
        daysAnalyzed: 7,
      },
    });
  });

  it('generates calories_under_target for a maintenance goal', async () => {
    await seedCompleteTracking({
      goalType: 'maintain',
      targetCalories: 2500,
      targetProteinGrams: 100,
      calories: 2300,
      protein: 100,
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);

    expect(
      recommendationOfType(response.body, 'calories_under_target').severity,
    ).toBe('low');
  });

  it('generates calories_over_target for a lose goal', async () => {
    await seedCompleteTracking({
      goalType: 'lose',
      targetCalories: 2000,
      targetProteinGrams: 100,
      calories: 2700,
      protein: 100,
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const item = recommendationOfType(response.body, 'calories_over_target');

    expect(item).toMatchObject({
      severity: 'high',
      title: 'Calories are above target',
      message:
        'You are averaging 700 kcal above your calorie target over the last 7 days.',
      sourceFacts: {
        targetCalories: 2000,
        averageCalories: 2700,
        differenceCalories: 700,
        goalType: 'lose',
        daysAnalyzed: 7,
      },
    });
  });

  it('generates calories_over_target for a maintenance goal', async () => {
    await seedCompleteTracking({
      goalType: 'maintain',
      targetCalories: 2500,
      targetProteinGrams: 100,
      calories: 2800,
      protein: 100,
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);

    expect(
      recommendationOfType(response.body, 'calories_over_target').severity,
    ).toBe('medium');
  });

  it('generates missing_recent_weight_logs when the last log is over 7 days old', async () => {
    await seedProfile();
    await seedSevenFoodDays({ calories: 2000, protein: 100 });
    const oldWeightAt = new Date(recentLocalDateTime(8));
    await prisma.weightLog.create({
      data: {
        userId: MOCK_USER_ID,
        weightLb: 180,
        loggedAt: oldWeightAt,
      },
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const item = recommendationOfType(
      response.body,
      'missing_recent_weight_logs',
    );

    expect(item).toMatchObject({
      severity: 'medium',
      title: 'A recent weight log is missing',
      sourceFacts: {
        lastWeightLoggedAt: oldWeightAt.toISOString(),
        daysSinceLastWeightLog: 8,
      },
    });
  });

  it('generates inconsistent_food_logging for three logged days', async () => {
    await seedProfile();
    await seedRecentWeight();
    await prisma.foodLog.createMany({
      data: Array.from({ length: 3 }, (_, dayOffset) => ({
        userId: MOCK_USER_ID,
        foodName: `Logged day ${dayOffset + 1}`,
        mealType: 'dinner' as const,
        calories: 500,
        protein: 30,
        loggedAt: new Date(recentLocalDateTime(dayOffset)),
      })),
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const item = recommendationOfType(
      response.body,
      'inconsistent_food_logging',
    );

    expect(item).toMatchObject({
      severity: 'low',
      title: 'Food logging has been inconsistent',
      message: 'You logged food on 3 of the last 7 days.',
      sourceFacts: {
        loggedDays: 3,
        expectedDays: 7,
        missingDays: 4,
        minimumLoggedDaysForIntakeRecommendations: 4,
      },
    });
  });

  it('gates intake recommendations when fewer than four days are logged', async () => {
    await seedProfile();
    await seedGoals({
      goalType: 'gain',
      targetCalories: 3000,
      targetProteinGrams: 150,
    });
    await seedRecentWeight();
    await prisma.foodLog.createMany({
      data: Array.from({ length: 3 }, (_, dayOffset) => ({
        userId: MOCK_USER_ID,
        foodName: `Incomplete day ${dayOffset + 1}`,
        mealType: 'dinner' as const,
        calories: 500,
        protein: 20,
        loggedAt: new Date(recentLocalDateTime(dayOffset)),
      })),
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const types = recommendations(response.body).map((item) => item.type);

    expect(types).toContain('inconsistent_food_logging');
    expect(types).not.toContain('protein_low');
    expect(types).not.toContain('calories_under_target');
    expect(types).not.toContain('calories_over_target');
  });

  it('allows deterministic intake recommendations at four logged days', async () => {
    await seedProfile();
    await seedGoals({
      goalType: 'gain',
      targetCalories: 3000,
      targetProteinGrams: 150,
    });
    await seedRecentWeight();
    await prisma.foodLog.createMany({
      data: Array.from({ length: 4 }, (_, dayOffset) => ({
        userId: MOCK_USER_ID,
        foodName: `Threshold day ${dayOffset + 1}`,
        mealType: 'dinner' as const,
        calories: 500,
        protein: 20,
        loggedAt: new Date(recentLocalDateTime(dayOffset)),
      })),
    });

    const response = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const types = recommendations(response.body).map((item) => item.type);

    expect(types).toContain('protein_low');
    expect(types).toContain('calories_under_target');
    expect(types).not.toContain('inconsistent_food_logging');
  });
});

describe('recommendation lifecycle', () => {
  it('updates an existing active recommendation without creating a duplicate', async () => {
    await seedCompleteTracking({
      goalType: 'gain',
      targetCalories: 2000,
      targetProteinGrams: 150,
      calories: 2000,
      protein: 115,
    });
    const first = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const firstProtein = recommendationOfType(first.body, 'protein_low');
    await prisma.foodLog.deleteMany({ where: { userId: MOCK_USER_ID } });
    await seedSevenFoodDays({ calories: 2000, protein: 80 });

    const second = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const secondProtein = recommendationOfType(second.body, 'protein_low');

    expect(secondProtein.id).toBe(firstProtein.id);
    expect(secondProtein.severity).toBe('high');
    expect(
      await prisma.recommendation.count({
        where: {
          userId: MOCK_USER_ID,
          type: 'protein_low',
          status: 'active',
        },
      }),
    ).toBe(1);
  });

  it('archives an active recommendation when its condition resolves', async () => {
    await seedCompleteTracking({
      goalType: 'gain',
      targetCalories: 2000,
      targetProteinGrams: 150,
      calories: 2000,
      protein: 100,
    });
    const generated = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const id = recommendationOfType(generated.body, 'protein_low').id;
    await prisma.foodLog.deleteMany({ where: { userId: MOCK_USER_ID } });
    await seedSevenFoodDays({ calories: 2000, protein: 150 });

    await api.post('/api/v1/recommendations/generate').expect(200);
    const archived = await api
      .get('/api/v1/recommendations')
      .query({ status: 'archived' })
      .expect(200);

    expect(recommendationOfType(archived.body, 'protein_low')).toMatchObject({
      id,
      status: 'archived',
    });
  });

  it('dismisses a recommendation and suppresses same-day regeneration', async () => {
    await seedCompleteTracking({
      goalType: 'gain',
      targetCalories: 3000,
      targetProteinGrams: 100,
      calories: 2500,
      protein: 100,
    });
    const generated = await api
      .post('/api/v1/recommendations/generate')
      .expect(200);
    const item = recommendationOfType(generated.body, 'calories_under_target');

    const dismissed = await api
      .patch(`/api/v1/recommendations/${item.id}/dismiss`)
      .expect(200);
    await api.post('/api/v1/recommendations/generate').expect(200);
    const active = await api
      .get('/api/v1/recommendations')
      .query({ status: 'active' })
      .expect(200);
    const dismissedList = await api
      .get('/api/v1/recommendations')
      .query({ status: 'dismissed' })
      .expect(200);

    expect(dismissed.body.data.status).toBe('dismissed');
    expect(
      recommendations(active.body).some(
        (recommendation) => recommendation.type === 'calories_under_target',
      ),
    ).toBe(false);
    expect(
      recommendationOfType(dismissedList.body, 'calories_under_target').id,
    ).toBe(item.id);
  });

  it('defaults GET to active and supports archived and dismissed filters', async () => {
    await prisma.recommendation.createMany({
      data: [
        {
          userId: MOCK_USER_ID,
          type: 'protein_low',
          severity: 'low',
          title: 'Active',
          message: 'Active',
          sourceFacts: {},
          status: 'active',
        },
        {
          userId: MOCK_USER_ID,
          type: 'calories_under_target',
          severity: 'medium',
          title: 'Dismissed',
          message: 'Dismissed',
          sourceFacts: {},
          status: 'dismissed',
        },
        {
          userId: MOCK_USER_ID,
          type: 'calories_over_target',
          severity: 'high',
          title: 'Archived',
          message: 'Archived',
          sourceFacts: {},
          status: 'archived',
        },
      ],
    });

    const active = await api.get('/api/v1/recommendations').expect(200);
    const dismissed = await api
      .get('/api/v1/recommendations')
      .query({ status: 'dismissed' })
      .expect(200);
    const archived = await api
      .get('/api/v1/recommendations')
      .query({ status: 'archived' })
      .expect(200);

    expect(recommendations(active.body).map((item) => item.status)).toEqual([
      'active',
    ]);
    expect(recommendations(dismissed.body).map((item) => item.status)).toEqual([
      'dismissed',
    ]);
    expect(recommendations(archived.body).map((item) => item.status)).toEqual([
      'archived',
    ]);
  });

  it('rejects an invalid status filter', async () => {
    const response = await api
      .get('/api/v1/recommendations')
      .query({ status: 'deleted' })
      .expect(400);

    expectErrorEnvelope(response.body, 'VALIDATION_ERROR');
  });

  it('reconciles stale micronutrient recommendations when switching to Simple mode', async () => {
    await seedProfile();
    await seedGoals({ goalType: 'maintain' });
    await seedRecentWeight();
    await seedSevenFoodDays({ calories: 2000, protein: 100 });
    await prisma.trackingPreference.create({
      data: { userId: MOCK_USER_ID, mode: 'complex' },
    });
    const recommendation = await prisma.recommendation.create({
      data: {
        userId: MOCK_USER_ID,
        type: 'micronutrient_below_target',
        identityKey: 'micronutrient_below_target:vitaminD',
        severity: 'high',
        title: 'vitaminD is below target',
        message: 'Logged vitamin D is below target.',
        sourceFacts: { confidenceScore: 100, rulePriority: 50 },
        status: 'active',
      },
    });

    await api
      .put('/api/v1/tracking-preferences')
      .send({ mode: 'simple', waterTrackingEnabled: false })
      .expect(200);

    const active = await api
      .get('/api/v1/recommendations')
      .query({ status: 'active' })
      .expect(200);
    expect(recommendations(active.body)).toEqual([]);
    expect(
      await prisma.recommendation.findUnique({
        where: { id: recommendation.id },
      }),
    ).toMatchObject({ status: 'archived' });
  });

  it('does not count an incompatible provider as DRI-comparable intake', async () => {
    await seedProfile();
    await seedGoals({ goalType: 'maintain' });
    await seedRecentWeight();
    await seedSevenFoodDays({ calories: 2000, protein: 100 });
    await prisma.trackingPreference.create({
      data: { userId: MOCK_USER_ID, mode: 'complex' },
    });
    const foodItem = await prisma.foodItem.create({
      data: {
        userId: null,
        name: 'Open food facts item',
        sourceType: 'cached_external',
        foodType: 'generic',
        normalizedName: 'open food facts item',
        searchText: 'open food facts item',
        sourceProvider: 'open_food_facts',
        sourceId: 'qa-off-vitamin-d',
      },
    });
    for (let day = 0; day < 4; day += 1) {
      await prisma.foodLog.create({
        data: {
          userId: MOCK_USER_ID,
          foodItemId: foodItem.id,
          foodName: foodItem.name,
          mealType: 'dinner',
          calories: 500,
          protein: 30,
          loggedAt: new Date(recentLocalDateTime(day)),
          nutrients: {
            create: [{ nutrientKey: 'vitaminD', amount: 1, unit: 'mcg' }],
          },
        },
      });
    }

    const facts = await computeRecommendationFacts(MOCK_USER_ID);

    expect(facts.micronutrients).toEqual([]);
  });
});
