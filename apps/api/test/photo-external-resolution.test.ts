import type {
  AiFoodParseCandidate,
  FoodItem,
  FoodItemServingOptions,
  PhotoRecognizedItem,
} from '@food-tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  applyPendingEstimates,
  resolveAutomaticExternalCandidates,
} from '../src/modules/ai/photo-analysis.js';

function externalCandidate(input: {
  name: string;
  sourceId: string;
  confidence?: 'high' | 'medium' | 'low';
  calories?: number | null;
  brandName?: string | null;
  foodType?: 'generic' | 'branded';
  servingOptions?: FoodItemServingOptions | null;
}): AiFoodParseCandidate {
  return {
    candidateType: 'external_food',
    foodItem: null,
    externalFood: {
      sourceProvider: 'usda_fdc',
      sourceId: input.sourceId,
      name: input.name,
      brandName: input.brandName ?? null,
      foodType: input.foodType ?? 'generic',
      servingBasisText: 'per 100 g',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      servingOptions: input.servingOptions ?? null,
      calories: input.calories === undefined ? 200 : input.calories,
      protein: 8,
      carbs: 20,
      fat: 5,
      fiber: null,
      sugar: null,
      sodium: null,
      nutrients: {},
    },
    rank: 1,
    matchReason: 'usda_fdc',
    confidence: input.confidence ?? 'high',
    defaultServingMultiplier: 1,
  };
}

function canonicalFood(input: {
  id: string;
  name: string;
  servingOptions?: FoodItemServingOptions | null;
}): FoodItem {
  return {
    id: input.id,
    name: input.name,
    brandName: null,
    sourceType: 'cached_external',
    foodType: 'generic',
    sourceProvider: 'usda_fdc',
    sourceId: '123',
    sourceUpdatedAt: null,
    isSaved: false,
    defaultServing: null,
    servingQuantity: 100,
    servingUnit: 'g',
    servingWeightGrams: 100,
    servingOptions: input.servingOptions ?? null,
    defaultWholeItemServing: null,
    calories: 200,
    protein: 8,
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

function row(
  candidates: AiFoodParseCandidate[],
  selectedCandidateId: string | null = null,
): PhotoRecognizedItem {
  return {
    id: 'photo-item-1',
    recognizedName: 'visible topping',
    preparationForm: null,
    identityConfidence: 'high',
    portionConfidence: 'high',
    region: null,
    provisionalPortion: {
      rawQuantityText: '100 g',
      rawServingText: '100 g',
      confidence: 'high',
      parsed: {
        status: 'parsed',
        quantity: 100,
        unit: 'g',
        rawQuantityText: '100',
        rawServingText: '100 g',
      },
      quantity: {
        state: 'estimated',
        amount: 100,
        unit: 'gram',
        countLabel: null,
        rawText: '100 g',
        confidence: 'high',
      },
      servingResolution: 'supported',
    },
    reviewStatus: selectedCandidateId === null ? 'needs_review' : 'matched',
    selectedCandidateId,
    loggable: selectedCandidateId !== null,
    candidates,
    unresolvedReason:
      selectedCandidateId === null ? 'low_candidate_confidence' : null,
    representationGroupId: 'group-1',
    representationKind: 'component',
    active: true,
    coverage: ['visible topping'],
    excludedCoverage: [],
    visiblePortionDescription: 'visible portion',
    adjudication: {
      selectionSource:
        selectedCandidateId === null ? 'user_required' : 'deterministic',
      status: 'not_needed',
      confidence: null,
      reviewReason: null,
    },
  };
}

describe('automatic external photo candidate resolution', () => {
  it('retains a bounded estimate when an external recommendation is not canonical yet', () => {
    const candidate = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
      confidence: 'medium',
    });
    const estimate = {
      calories: 100,
      proteinGrams: 4,
      carbohydrateGrams: 10,
      fatGrams: 2,
      confidence: 'medium' as const,
    };
    const pending = applyPendingEstimates({
      rows: [
        {
          ...row([candidate], 'usda_fdc:123'),
          loggable: false,
          reviewStatus: 'needs_review',
        },
      ],
      pendingEstimates: new Map([['photo-item-1', estimate]]),
    });

    expect(pending[0]?.selectedCandidateId).toBe('usda_fdc:123');
    expect(pending[0]?.estimatedNutrition).toMatchObject({
      source: 'ai_estimate',
      calories: 100,
    });
  });

  it('discards a retained fallback estimate once a canonical identity exists', () => {
    const canonical = canonicalFood({ id: 'food-1', name: 'visible topping' });
    const canonicalCandidate: AiFoodParseCandidate = {
      candidateType: 'food_item',
      foodItem: canonical,
      externalFood: null,
      rank: 1,
      matchReason: 'saved',
      confidence: 'high',
      defaultServingMultiplier: 1,
    };
    const result = applyPendingEstimates({
      rows: [
        {
          ...row([canonicalCandidate], 'food-1'),
          loggable: false,
          reviewStatus: 'needs_review',
        },
      ],
      pendingEstimates: new Map([
        [
          'photo-item-1',
          {
            calories: 100,
            proteinGrams: 4,
            carbohydrateGrams: 10,
            fatGrams: 2,
            confidence: 'medium',
          },
        ],
      ]),
    });

    expect(result[0]?.estimatedNutrition).toBeUndefined();
    expect(result[0]?.selectedCandidateId).toBe('food-1');
  });

  it('materializes a high-confidence external winner and returns a trusted canonical row', async () => {
    const candidate = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
    });
    const materialize = vi.fn(async () =>
      canonicalFood({
        id: 'food-1',
        name: candidate.externalFood?.name ?? 'visible topping',
      }),
    );

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [row([candidate])],
        materialize,
      })
    )[0]!;

    expect(materialize).toHaveBeenCalledTimes(1);
    expect(resolved).toMatchObject({
      selectedCandidateId: 'food-1',
      loggable: true,
      reviewStatus: 'matched',
    });
    expect(resolved.estimatedNutrition).toBeUndefined();
    expect(
      resolved.candidates.some((item) => item.candidateType === 'food_item'),
    ).toBe(true);
  });

  it('preserves and resolves a structured photo quantity during external materialization', async () => {
    const servingOptions: FoodItemServingOptions = {
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
    const candidate = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
      servingOptions,
    });
    const materialize = vi.fn(async () =>
      canonicalFood({
        id: 'food-1',
        name: 'visible topping',
        servingOptions,
      }),
    );
    const withPhotoQuantity: PhotoRecognizedItem = {
      ...row([candidate]),
      provisionalPortion: {
        rawQuantityText: '2',
        rawServingText: '2 tbsp',
        confidence: 'medium',
        parsed: {
          status: 'parsed',
          quantity: 2,
          unit: 'tbsp',
          rawQuantityText: '2',
          rawServingText: '2 tbsp',
        },
        quantity: {
          state: 'estimated',
          amount: 2,
          unit: 'tablespoon',
          countLabel: null,
          rawText: 'approximately 2 tablespoons',
          confidence: 'medium',
          source: 'vision_structured',
        },
        servingResolution: 'supported',
      },
    };

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [withPhotoQuantity],
        materialize,
      })
    )[0]!;

    expect(resolved).toMatchObject({
      selectedCandidateId: 'food-1',
      loggable: true,
      reviewStatus: 'matched',
      provisionalPortion: {
        servingResolution: 'supported',
        resolvedServing: {
          status: 'resolved',
          quantity: 2,
          unit: 'tbsp',
          servingOptionId: 'tbsp-1',
          multiplier: 0.1,
          method: 'provider_serving',
        },
      },
    });
  });

  it('keeps a trusted canonical winner in serving review when no photo quantity exists', async () => {
    const candidate = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
    });
    const materialize = vi.fn(async () =>
      canonicalFood({ id: 'food-1', name: 'visible topping' }),
    );
    const withoutPhotoQuantity: PhotoRecognizedItem = {
      ...row([candidate]),
      provisionalPortion: {
        rawQuantityText: null,
        rawServingText: null,
        confidence: null,
        parsed: {
          status: 'missing',
          quantity: null,
          unit: null,
          reason: 'no_explicit_serving',
          rawQuantityText: null,
          rawServingText: null,
        },
        quantity: { state: 'no_responsible_estimate' },
        servingResolution: 'not_attempted',
      },
      adjudication: {
        selectionSource: 'ai_adjudicated',
        status: 'selected',
        confidence: 'high',
        reviewReason: 'portion_needs_review',
      },
    };

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [withoutPhotoQuantity],
        materialize,
      })
    )[0]!;

    expect(materialize).toHaveBeenCalledTimes(1);
    expect(resolved).toMatchObject({
      selectedCandidateId: 'food-1',
      loggable: false,
      reviewStatus: 'needs_review',
      unresolvedReason: 'portion_needs_review',
    });
    expect(resolved.provisionalPortion).toMatchObject({
      servingResolution: 'needs_review',
      resolvedServing: {
        status: 'needs_review',
        quantity: null,
        unit: null,
      },
    });
  });

  it.each([
    ['cup', 'cup'],
    ['tablespoon', 'tbsp'],
    ['count', 'item'],
  ] as const)(
    'materializes a trusted identity when a %s photo quantity needs serving review',
    async (_label, parsedUnit) => {
      const candidate = externalCandidate({
        name: 'visible topping',
        sourceId: '123',
      });
      const materialize = vi.fn(async () =>
        canonicalFood({ id: 'food-1', name: 'visible topping' }),
      );
      const diagnostics = vi.fn();
      const unsupportedQuantity: PhotoRecognizedItem = {
        ...row([candidate]),
        provisionalPortion: {
          rawQuantityText: '1',
          rawServingText: `1 ${_label}`,
          confidence: 'medium',
          parsed: {
            status: 'parsed',
            quantity: 1,
            unit: parsedUnit,
            rawQuantityText: '1',
            rawServingText: `1 ${_label}`,
          },
          quantity: {
            state: 'estimated',
            amount: 1,
            unit:
              parsedUnit === 'cup'
                ? 'cup'
                : parsedUnit === 'tbsp'
                  ? 'tablespoon'
                  : 'count',
            countLabel: parsedUnit === 'item' ? 'piece' : null,
            rawText: `approximately 1 ${_label}`,
            confidence: 'medium',
            source: 'vision_structured',
          },
          servingResolution: 'needs_review',
        },
        loggable: false,
        reviewStatus: 'needs_review',
      };

      const resolved = (
        await resolveAutomaticExternalCandidates({
          rows: [unsupportedQuantity],
          materialize,
          diagnostics,
        })
      )[0]!;

      expect(materialize).toHaveBeenCalledTimes(1);
      expect(resolved).toMatchObject({
        selectedCandidateId: 'food-1',
        loggable: false,
        reviewStatus: 'needs_review',
        unresolvedReason: 'portion_needs_review',
        provisionalPortion: {
          servingResolution: 'needs_review',
          resolvedServing: {
            status: 'needs_review',
            quantity: 1,
          },
        },
      });
      expect(resolved.estimatedNutrition).toBeUndefined();
      expect(diagnostics).toHaveBeenCalledWith(
        expect.objectContaining({
          materializationEligible: true,
          materializationSuccess: true,
          identityMaterializationEligible: true,
          identityMaterializationSuccess: true,
          servingReviewRequired: true,
          materializationSuppressionReason: null,
        }),
      );
    },
  );

  it('accepts a bounded high-confidence adjudication of an available medium-ranked external winner', async () => {
    const candidate = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
      confidence: 'medium',
    });
    const materialize = vi.fn(async () =>
      canonicalFood({ id: 'food-1', name: 'visible topping' }),
    );
    const adjudicated: PhotoRecognizedItem = {
      ...row([candidate]),
      adjudication: {
        selectionSource: 'ai_adjudicated',
        status: 'selected',
        confidence: 'high',
        reviewReason: null,
      },
    };

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [adjudicated],
        materialize,
      })
    )[0]!;

    expect(materialize).toHaveBeenCalledTimes(1);
    expect(resolved.selectedCandidateId).toBe('food-1');
  });

  it('materializes a high-confidence adjudication despite a lower deterministic score', async () => {
    const misleading = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
      brandName: 'unrelated brand',
      foodType: 'branded',
    });
    const adjudicated = externalCandidate({
      name: 'visible topping prepared',
      sourceId: '456',
    });
    const materialize = vi.fn(async () =>
      canonicalFood({ id: 'food-2', name: 'visible topping prepared' }),
    );
    const rowWithAdjudication: PhotoRecognizedItem = {
      ...row([misleading, adjudicated], 'usda_fdc:456'),
      adjudication: {
        selectionSource: 'ai_adjudicated',
        status: 'selected',
        confidence: 'high',
        reviewReason: null,
      },
    };

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [rowWithAdjudication],
        materialize,
      })
    )[0]!;

    expect(materialize).toHaveBeenCalledTimes(1);
    expect(resolved.selectedCandidateId).toBe('food-2');
    expect(resolved.loggable).toBe(true);
  });

  it('does not materialize ambiguous external candidates and preserves estimation', async () => {
    const first = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
    });
    const second = externalCandidate({
      name: 'visible topping prepared',
      sourceId: '456',
    });
    const estimate = {
      calories: 100,
      proteinGrams: 4,
      carbohydrateGrams: 10,
      fatGrams: 2,
      confidence: 'medium' as const,
      basis: 'portion_shown' as const,
      source: 'ai_estimate' as const,
      trust: 'low' as const,
      editable: true as const,
      linkedFoodItemId: null,
      label: 'visible topping',
    };
    const materialize = vi.fn();
    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [{ ...row([first, second]), estimatedNutrition: estimate }],
        materialize,
      })
    )[0]!;

    expect(materialize).not.toHaveBeenCalled();
    expect(resolved.selectedCandidateId).toBeNull();
    expect(resolved.estimatedNutrition).toEqual(estimate);
  });

  it('does not treat duplicate external records in one family as semantic ambiguity', async () => {
    const first = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
    });
    const duplicate = externalCandidate({
      name: 'visible topping',
      sourceId: '456',
    });
    const materialize = vi.fn(async () =>
      canonicalFood({ id: 'food-family', name: 'visible topping' }),
    );

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [row([first, duplicate])],
        materialize,
      })
    )[0]!;

    expect(materialize).toHaveBeenCalledTimes(1);
    expect(resolved.selectedCandidateId).toBe('food-family');
    expect(resolved.loggable).toBe(true);
  });

  it('does not materialize an external candidate when a local canonical candidate wins', async () => {
    const local = {
      candidateType: 'food_item' as const,
      foodItem: canonicalFood({ id: 'local-1', name: 'visible topping' }),
      externalFood: null,
      rank: 1,
      matchReason: 'cached_external' as const,
      confidence: 'high' as const,
      defaultServingMultiplier: 1,
    };
    const external = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
    });
    const materialize = vi.fn();
    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [row([local, external], 'local-1')],
        materialize,
      })
    )[0]!;

    expect(materialize).not.toHaveBeenCalled();
    expect(resolved.selectedCandidateId).toBe('local-1');
  });

  it('does not materialize unavailable external candidates', async () => {
    const candidate = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
      calories: null,
    });
    const materialize = vi.fn();

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [
          {
            ...row([candidate], 'usda_fdc:123'),
            loggable: false,
            reviewStatus: 'needs_review',
          },
        ],
        materialize,
      })
    )[0]!;

    expect(materialize).not.toHaveBeenCalled();
    expect(resolved.selectedCandidateId).toBeNull();
  });

  it('does not materialize a candidate rejected by adjudication', async () => {
    const candidate = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
    });
    const materialize = vi.fn();
    const rejected = {
      ...row([candidate]),
      adjudication: {
        selectionSource: 'user_required' as const,
        status: 'rejected_all' as const,
        confidence: 'high' as const,
        reviewReason: 'adjudication_rejected_all',
      },
    };

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [rejected],
        materialize,
      })
    )[0]!;

    expect(materialize).not.toHaveBeenCalled();
    expect(resolved.selectedCandidateId).toBeNull();
  });

  it('keeps a valid estimate when automatic materialization fails', async () => {
    const candidate = externalCandidate({
      name: 'visible topping',
      sourceId: '123',
    });
    const estimate = {
      calories: 100,
      proteinGrams: 4,
      carbohydrateGrams: 10,
      fatGrams: 2,
      confidence: 'medium' as const,
      basis: 'portion_shown' as const,
      source: 'ai_estimate' as const,
      trust: 'low' as const,
      editable: true as const,
      linkedFoodItemId: null,
      label: 'visible topping',
    };
    const materialize = vi.fn(async () => {
      throw new Error('provider unavailable');
    });

    const resolved = (
      await resolveAutomaticExternalCandidates({
        rows: [{ ...row([candidate]), estimatedNutrition: estimate }],
        materialize,
      })
    )[0]!;

    expect(materialize).toHaveBeenCalledTimes(1);
    expect(resolved.selectedCandidateId).toBeNull();
    expect(resolved.loggable).toBe(false);
    expect(resolved.estimatedNutrition).toEqual(estimate);
  });
});
