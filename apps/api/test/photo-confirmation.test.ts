import { MOCK_USER_ID } from '@food-tracker/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { issuePhotoEstimateProof } from '../src/modules/ai/photo-estimate-proof.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const proofSecret = 'c1-integration-secret-with-at-least-32-bytes';
const loggedAt = '2026-07-14T17:00:00.000Z';

function proof(
  rowRef: string,
  basis: 'portion_shown' | 'structured_quantity' = 'portion_shown',
) {
  return issuePhotoEstimateProof({
    secret: proofSecret,
    userId: MOCK_USER_ID,
    rowRef,
    recognizedName: rowRef === 'photo-item-2' ? 'Pasta' : 'Estimated meal',
    preparationForm: null,
    representationKind: 'component',
    estimateBasis: basis,
    quantity:
      basis === 'structured_quantity'
        ? {
            state: 'estimated' as const,
            amount: 1.5,
            unit: 'cup' as const,
            countLabel: null,
            rawText: 'approximately 1.5 cups',
            confidence: 'medium' as const,
          }
        : { state: 'no_responsible_estimate' as const },
    estimate: {
      calories: 460,
      proteinGrams: 15.3,
      carbohydrateGrams: 76.1,
      fatGrams: 11,
      confidence: 'low',
    },
    ttlSeconds: 900,
  });
}

async function trustedFood() {
  return prisma.foodItem.create({
    data: {
      userId: MOCK_USER_ID,
      name: 'Trusted eggs',
      normalizedName: 'trusted eggs',
      searchText: 'trusted eggs',
      sourceType: 'user_custom',
      foodType: 'generic',
      servingQuantity: 1,
      servingUnit: 'egg',
      calories: 70,
      protein: 6.3,
      carbs: 0.4,
      fat: 4.8,
    },
  });
}

describe('mixed photo confirmation', () => {
  afterEach(() => {
    delete process.env.PHOTO_ESTIMATE_CONFIRMATION_ENABLED;
    delete process.env.PHOTO_ESTIMATE_PROOF_SECRET;
    delete process.env.PHOTO_ESTIMATE_PROOF_TTL_SECONDS;
  });

  it('atomically saves trusted, estimated, and excluded rows in input order', async () => {
    process.env.PHOTO_ESTIMATE_CONFIRMATION_ENABLED = 'true';
    process.env.PHOTO_ESTIMATE_PROOF_SECRET = proofSecret;
    const food = await trustedFood();

    const response = await api
      .post('/api/v1/food-logs/from-photo-analysis')
      .send({
        mealType: 'dinner',
        loggedAt,
        entries: [
          {
            rowRef: 'photo-item-1',
            disposition: 'trusted',
            candidateId: food.id,
            servingMultiplier: 2,
          },
          {
            rowRef: 'photo-item-2',
            disposition: 'estimated',
            estimateProof: proof('photo-item-2', 'structured_quantity'),
          },
          { rowRef: 'photo-item-3', disposition: 'excluded' },
        ],
      })
      .expect(200);

    expect(response.body.data.createdTrustedCount).toBe(1);
    expect(response.body.data.createdEstimatedCount).toBe(1);
    expect(response.body.data.excludedCount).toBe(1);
    expect(
      response.body.data.foodLogs.map(
        (entry: { rowRef: string }) => entry.rowRef,
      ),
    ).toEqual(['photo-item-1', 'photo-item-2']);
    expect(response.body.data.foodLogs[0].foodLog.foodItemId).toBe(food.id);
    expect(response.body.data.foodLogs[1].foodLog.foodItemId).toBeNull();
    expect(response.body.data.foodLogs[1].foodLog.servingQuantity).toBe(1.5);
    expect(response.body.data.foodLogs[1].foodLog.servingUnit).toBe('cup');
    expect(
      response.body.data.foodLogs[1].foodLog.servingSnapshot.provenance,
    ).toEqual({
      basisOrigin: 'ai_estimate',
      foodItemId: null,
      sourceType: null,
      sourceProvider: null,
      sourceId: null,
      trustLevel: 'low',
    });
    expect(response.body.data.foodLogs[1].foodLog.notes).toContain(
      'AI-estimated nutrition: low trust',
    );
    expect(await prisma.foodLog.count()).toBe(2);
    expect(await prisma.foodItem.count()).toBe(1);
  });

  it('rejects unsigned or disabled estimated confirmation without writes', async () => {
    const response = await api
      .post('/api/v1/food-logs/from-photo-analysis')
      .send({
        mealType: 'dinner',
        loggedAt,
        entries: [
          {
            rowRef: 'photo-item-1',
            disposition: 'estimated',
            estimateProof: 'unsigned',
          },
        ],
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'ESTIMATE_CONFIRMATION_DISABLED');
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('allows user-adjusted low-trust nutrition and name without creating a FoodItem', async () => {
    process.env.PHOTO_ESTIMATE_CONFIRMATION_ENABLED = 'true';
    process.env.PHOTO_ESTIMATE_PROOF_SECRET = proofSecret;

    const response = await api
      .post('/api/v1/food-logs/from-photo-analysis')
      .send({
        mealType: 'lunch',
        loggedAt,
        entries: [
          {
            rowRef: 'photo-item-1',
            disposition: 'estimated',
            estimateProof: proof('photo-item-1'),
            confirmedFoodName: 'My corrected meal',
            userAdjustedNutrition: {
              calories: 500,
              proteinGrams: 20,
              carbohydrateGrams: 60,
              fatGrams: 15,
            },
          },
        ],
      })
      .expect(200);

    expect(response.body.data.foodLogs[0].foodLog).toMatchObject({
      foodName: 'My corrected meal',
      calories: 500,
      protein: 20,
      carbs: 60,
      fat: 15,
      foodItemId: null,
    });
    expect(response.body.data.foodLogs[0].foodLog.notes).toContain('adjusted');
    expect(await prisma.foodItem.count()).toBe(0);
  });

  it('rolls back all rows when a trusted candidate is invalid', async () => {
    process.env.PHOTO_ESTIMATE_CONFIRMATION_ENABLED = 'true';
    process.env.PHOTO_ESTIMATE_PROOF_SECRET = proofSecret;
    const food = await trustedFood();

    const response = await api
      .post('/api/v1/food-logs/from-photo-analysis')
      .send({
        mealType: 'dinner',
        loggedAt,
        entries: [
          {
            rowRef: 'photo-item-1',
            disposition: 'trusted',
            candidateId: food.id,
            servingMultiplier: 1,
          },
          {
            rowRef: 'photo-item-2',
            disposition: 'estimated',
            estimateProof: proof('photo-item-2'),
          },
          {
            rowRef: 'photo-item-3',
            disposition: 'trusted',
            candidateId: '00000000-0000-4000-8000-000000000099',
            servingMultiplier: 1,
          },
        ],
      })
      .expect(422);

    expectErrorEnvelope(response.body, 'INVALID_TRUSTED_CANDIDATE');
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('rolls back an earlier estimate when the final trusted insert fails', async () => {
    process.env.PHOTO_ESTIMATE_CONFIRMATION_ENABLED = 'true';
    process.env.PHOTO_ESTIMATE_PROOF_SECRET = proofSecret;
    const overflowingFood = await prisma.foodItem.create({
      data: {
        userId: MOCK_USER_ID,
        name: 'Overflow candidate',
        normalizedName: 'overflow candidate',
        searchText: 'overflow candidate',
        sourceType: 'user_custom',
        foodType: 'generic',
        servingQuantity: 1,
        servingUnit: 'egg',
        calories: 70,
        protein: 99999.9,
      },
    });

    await api
      .post('/api/v1/food-logs/from-photo-analysis')
      .send({
        mealType: 'dinner',
        loggedAt,
        entries: [
          {
            rowRef: 'photo-item-1',
            disposition: 'estimated',
            estimateProof: proof('photo-item-1'),
          },
          {
            rowRef: 'photo-item-2',
            disposition: 'trusted',
            candidateId: overflowingFood.id,
            servingMultiplier: 2,
          },
        ],
      })
      .expect(500);

    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('rejects tampered proofs and duplicate row references', async () => {
    process.env.PHOTO_ESTIMATE_CONFIRMATION_ENABLED = 'true';
    process.env.PHOTO_ESTIMATE_PROOF_SECRET = proofSecret;
    const tampered = `${proof('photo-item-1')}x`;
    const response = await api
      .post('/api/v1/food-logs/from-photo-analysis')
      .send({
        mealType: 'dinner',
        loggedAt,
        entries: [
          {
            rowRef: 'photo-item-1',
            disposition: 'estimated',
            estimateProof: tampered,
          },
          { rowRef: 'photo-item-1', disposition: 'excluded' },
        ],
      })
      .expect(400);

    expectErrorEnvelope(response.body, 'DUPLICATE_ROW_REFERENCE');
    expect(await prisma.foodLog.count()).toBe(0);
  });
});
