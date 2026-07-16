import type {
  AiFoodParseCandidate,
  FoodItem,
  FoodItemServingOptions,
  ParsedServingSuggestion,
  PhotoProvisionalQuantity,
  PhotoQuantityUnit,
} from '@food-tracker/shared';
import { describe, expect, it } from 'vitest';
import { resolvePhotoQuantityAgainstCandidate } from '../src/modules/ai/photo-serving-resolution.js';

function food(servingOptions: FoodItemServingOptions | null = null): FoodItem {
  return {
    id: '00000000-0000-4000-8000-000000000014',
    name: 'test food',
    brandName: null,
    sourceType: 'cached_external',
    foodType: 'generic',
    sourceProvider: 'usda_fdc',
    sourceId: 'test-food',
    sourceUpdatedAt: null,
    isSaved: false,
    servingQuantity: 100,
    servingUnit: 'g',
    servingWeightGrams: 100,
    servingOptions,
    defaultWholeItemServing: null,
    calories: 200,
    protein: 10,
    carbs: 20,
    fat: 5,
    fiber: null,
    sugar: null,
    sodium: null,
    additionalNutrients: null,
    nutrients: {},
    barcodes: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function candidate(item: FoodItem): AiFoodParseCandidate {
  return {
    candidateType: 'food_item',
    foodItem: item,
    externalFood: null,
    rank: 1,
    matchReason: 'saved',
    confidence: 'high',
    defaultServingMultiplier: 1,
  };
}

function parsed(quantity: number, unit: string): ParsedServingSuggestion {
  return {
    status: 'parsed',
    quantity,
    unit,
    rawQuantityText: String(quantity),
    rawServingText: `${quantity} ${unit}`,
  } as ParsedServingSuggestion;
}

function estimated(
  amount: number,
  unit: PhotoQuantityUnit,
  confidence: 'high' | 'medium' | 'low',
): Extract<PhotoProvisionalQuantity, { state: 'estimated' }> {
  return {
    state: 'estimated',
    amount,
    unit,
    countLabel: unit === 'count' ? 'piece' : null,
    rawText: `${amount} ${unit}`,
    confidence,
  };
}

const tablespoonOption: FoodItemServingOptions = {
  schemaVersion: 1,
  options: [
    {
      id: 'tbsp-1',
      label: '1 tablespoon',
      quantity: 1,
      unit: 'tbsp',
      unitFamily: 'household',
      equivalentWeightGrams: 5,
      equivalentVolumeMl: 15,
      source: 'provider',
      trust: 'trusted',
      provider: 'usda_fdc',
      providerDescription: 'tablespoon',
    },
  ],
};

const pieceOption: FoodItemServingOptions = {
  schemaVersion: 1,
  options: [
    {
      id: 'piece-1',
      label: '1 piece',
      quantity: 1,
      unit: 'item',
      unitFamily: 'count',
      equivalentWeightGrams: 50,
      equivalentVolumeMl: null,
      source: 'provider',
      trust: 'trusted',
      provider: 'usda_fdc',
      providerDescription: 'piece',
    },
  ],
};

describe('photo quantity serving resolution', () => {
  it('resolves a visible tablespoon against a provider tablespoon alias', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food(tablespoonOption)),
      quantity: estimated(2, 'tablespoon', 'medium'),
      parsed: parsed(2, 'tbsp'),
    });

    expect(resolution).toMatchObject({
      servingResolution: 'supported',
      userReviewRequired: false,
      resolvedServing: {
        status: 'resolved',
        quantity: 2,
        unit: 'tbsp',
        servingOptionId: 'tbsp-1',
        multiplier: 0.1,
        method: 'provider_serving',
        normalizedGrams: 10,
        normalizedGramsConfidence: 'medium',
        normalizationMethod: 'provider_serving_conversion',
      },
    });
  });

  it('keeps a low-confidence structured quantity for review', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food(tablespoonOption)),
      quantity: estimated(2, 'tablespoon', 'low'),
      parsed: parsed(2, 'tbsp'),
    });

    expect(resolution).toMatchObject({
      servingResolution: 'supported',
      userReviewRequired: true,
      resolvedServing: {
        status: 'needs_review',
        quantity: 2,
        unit: 'tbsp',
        servingOptionId: 'tbsp-1',
        multiplier: 0.1,
        method: 'provider_serving',
        reason: 'low_confidence',
      },
    });
  });

  it('uses the canonical 100 g basis only as an explicit 35 g conversion', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food()),
      quantity: estimated(35, 'gram', 'medium'),
      parsed: parsed(35, 'g'),
    });

    expect(resolution).toMatchObject({
      servingResolution: 'supported',
      userReviewRequired: false,
      resolvedServing: {
        status: 'resolved',
        quantity: 35,
        unit: 'g',
        servingOptionId: null,
        multiplier: 0.35,
        method: 'mass_conversion',
      },
    });
  });

  it('converts ounces deterministically without guessing density', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food()),
      quantity: estimated(1, 'ounce', 'medium'),
      parsed: parsed(1, 'oz'),
    });

    expect(resolution).toMatchObject({
      servingResolution: 'supported',
      resolvedServing: {
        status: 'resolved',
        quantity: 1,
        unit: 'oz',
        method: 'mass_conversion',
      },
    });
    expect(resolution.resolvedServing.multiplier).toBeCloseTo(
      0.28349523125,
      12,
    );
  });

  it('resolves count and piece quantities against a trusted item serving', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food(pieceOption)),
      quantity: estimated(2, 'piece', 'medium'),
      parsed: parsed(2, 'item'),
    });

    expect(resolution).toMatchObject({
      servingResolution: 'supported',
      resolvedServing: {
        status: 'resolved',
        quantity: 2,
        unit: 'item',
        servingOptionId: 'piece-1',
        multiplier: 1,
        method: 'provider_serving',
      },
    });
  });

  it('keeps a trusted food with no responsible estimate in serving review', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food()),
      quantity: { state: 'no_responsible_estimate' },
      parsed: null,
    });

    expect(resolution).toMatchObject({
      servingResolution: 'needs_review',
      userReviewRequired: true,
      resolvedServing: {
        status: 'needs_review',
        quantity: null,
        unit: null,
        servingOptionId: null,
        multiplier: null,
        reason: 'no_quantity',
      },
    });
  });

  it('does not guess a cup-to-gram conversion without provider density', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food()),
      quantity: estimated(1, 'cup', 'medium'),
      parsed: parsed(1, 'cup'),
    });

    expect(resolution).toMatchObject({
      servingResolution: 'needs_review',
      userReviewRequired: true,
      resolvedServing: {
        status: 'needs_review',
        quantity: 1,
        unit: 'cup',
        multiplier: null,
        reason: 'no_safe_conversion',
        normalizedGrams: null,
        normalizationMethod: 'unresolved',
      },
    });
  });

  it('uses an independent AI photo mass estimate when household conversion is unavailable', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food()),
      quantity: {
        ...estimated(2, 'tablespoon', 'medium'),
        massEstimateGrams: 10,
        massEstimateConfidence: 'medium',
      },
      parsed: parsed(2, 'tbsp'),
    });

    expect(resolution).toMatchObject({
      servingResolution: 'supported',
      userReviewRequired: true,
      resolvedServing: {
        status: 'needs_review',
        quantity: 2,
        unit: 'tbsp',
        normalizedGrams: 10,
        normalizedGramsConfidence: 'medium',
        normalizationMethod: 'ai_photo_mass_estimate',
        requiresUserReview: true,
      },
    });
  });

  it('does not copy an unsupported household value into normalized grams', () => {
    const resolution = resolvePhotoQuantityAgainstCandidate({
      candidate: candidate(food()),
      quantity: estimated(2, 'tablespoon', 'medium'),
      parsed: parsed(2, 'tbsp'),
    });

    expect(resolution.resolvedServing.normalizedGrams).toBeNull();
    expect(resolution.resolvedServing.normalizationMethod).toBe('unresolved');
  });
});
