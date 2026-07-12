import {
  foodItemServingOptionsSchema,
  foodLogServingSnapshotSchema,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';

const option = {
  id: 'provider:open_food_facts:123:cup-240ml',
  label: '1 cup',
  quantity: 1,
  unit: 'cup',
  unitFamily: 'household',
  equivalentWeightGrams: null,
  equivalentVolumeMl: 240,
  source: 'provider',
  trust: 'trusted',
  provider: 'open_food_facts',
  providerDescription: '1 cup (240 ml)',
} as const;

describe('serving persistence schemas', () => {
  it('accepts one alternate trusted provider option and rejects semantic duplicates', () => {
    expect(
      foodItemServingOptionsSchema.safeParse({
        schemaVersion: 1,
        options: [option],
      }).success,
    ).toBe(true);
    expect(
      foodItemServingOptionsSchema.safeParse({
        schemaVersion: 1,
        options: [option, { ...option, id: 'different-id', label: 'Cup' }],
      }).success,
    ).toBe(false);
  });

  it('requires complete resolved snapshots and rejects review outcomes', () => {
    const snapshot = {
      schemaVersion: 1,
      nutritionBasis: {
        quantity: 100,
        unit: 'g',
        unitFamily: 'mass',
        displayText: 'per 100 g',
        equivalentWeightGrams: 100,
        equivalentVolumeMl: null,
      },
      requestedServing: {
        quantity: 200,
        unit: 'g',
        unitFamily: 'mass',
        servingOptionId: null,
        selectedServingOption: null,
      },
      resolution: {
        status: 'exact',
        reason: 'same_basis',
        multiplier: 2,
        resolvedWeightGrams: 200,
        resolvedVolumeMl: null,
      },
      basisNutrition: {
        calories: 100,
        protein: 4,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrients: {},
      },
      nutritionOverride: null,
      provenance: {
        basisOrigin: 'manual_basis',
        foodItemId: null,
        sourceType: null,
        sourceProvider: null,
        sourceId: null,
        trustLevel: 'user_entered',
      },
    } as const;

    expect(foodLogServingSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      foodLogServingSnapshotSchema.safeParse({
        ...snapshot,
        resolution: { ...snapshot.resolution, status: 'needs_review' },
      }).success,
    ).toBe(false);
  });
});
