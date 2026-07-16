import {
  classifyServingUnit,
  resolveServingRequest,
  type AiFoodParseCandidate,
  type ParsedServingSuggestion,
  type PhotoProvisionalQuantity,
  type PhotoQuantityUnit,
  type PhotoResolvedServing,
  type PhotoServingResolution,
  type ServingUnit,
} from '@food-tracker/shared';

function candidateFood(candidate: AiFoodParseCandidate) {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem
    : candidate.externalFood;
}

function resolutionOptions(
  options:
    | {
        options: readonly {
          id: string;
          label: string;
          quantity: number;
          unit: string;
          equivalentWeightGrams: number | null;
          equivalentVolumeMl: number | null;
          source: 'provider' | 'manual';
          trust: 'trusted';
          providerDescription: string | null;
        }[];
      }
    | null
    | undefined,
) {
  return (
    options?.options.map((option) => ({
      id: option.id,
      label: option.label,
      quantity: option.quantity,
      unit: option.unit,
      equivalentWeightGrams: option.equivalentWeightGrams,
      equivalentVolumeMl: option.equivalentVolumeMl,
      source: option.source,
      trust: option.trust,
      providerDescription: option.providerDescription,
    })) ?? []
  );
}

export function photoQuantityUnitToServingUnit(
  quantity: Pick<
    Extract<PhotoProvisionalQuantity, { state: 'estimated' }>,
    'unit' | 'countLabel'
  > & { unit: PhotoQuantityUnit },
): ServingUnit | null {
  if (quantity.unit === 'count') {
    switch (quantity.countLabel?.trim().toLocaleLowerCase()) {
      case 'egg':
        return 'egg';
      case 'slice':
        return 'slice';
      case 'bar':
        return 'bar';
      default:
        return 'item';
    }
  }

  switch (quantity.unit) {
    case 'slice':
      return 'slice';
    case 'piece':
      return 'item';
    case 'tablespoon':
      return 'tbsp';
    case 'teaspoon':
      return 'tsp';
    case 'cup':
      return 'cup';
    case 'millilitre':
      return 'ml';
    case 'gram':
      return 'g';
    case 'ounce':
      return 'oz';
  }
}

type PhotoQuantityResolution = {
  servingResolution: PhotoServingResolution;
  resolvedServing: PhotoResolvedServing;
  userReviewRequired: boolean;
};

function unresolvedServing(input: {
  quantity: number | null;
  unit: ServingUnit | null;
  reason: PhotoResolvedServing['reason'];
  source: PhotoResolvedServing['source'];
}): PhotoQuantityResolution {
  return {
    servingResolution: 'needs_review',
    userReviewRequired: true,
    resolvedServing: {
      status: 'needs_review',
      quantity: input.quantity,
      unit: input.unit,
      servingOptionId: null,
      multiplier: null,
      method: null,
      reason: input.reason,
      source: input.source,
      reviewRequired: true,
      normalizedGrams: null,
      normalizedGramsConfidence: null,
      normalizationMethod: 'unresolved',
      requiresUserReview: true,
    },
  };
}

function resolutionMethod(input: {
  requestUnit: string;
  requestFamily: string | null;
  servingOptionId: string | null;
}): PhotoResolvedServing['method'] {
  if (input.servingOptionId !== null) return 'provider_serving';
  if (input.requestFamily === 'mass') return 'mass_conversion';
  if (input.requestFamily === 'volume') return 'volume_conversion';
  if (input.requestFamily === 'count') return 'count_serving';
  return input.requestUnit === 'item' ? 'count_serving' : 'serving_alias';
}

export function resolvePhotoQuantityAgainstCandidate(input: {
  candidate: AiFoodParseCandidate;
  quantity: PhotoProvisionalQuantity;
  parsed: ParsedServingSuggestion | null;
}): PhotoQuantityResolution {
  if (input.quantity.state === 'no_responsible_estimate') {
    return unresolvedServing({
      quantity: null,
      unit: null,
      reason: 'no_quantity',
      source: 'unresolved_visible_portion',
    });
  }

  const requestedUnit = photoQuantityUnitToServingUnit(input.quantity);
  const parsedQuantity =
    input.parsed?.quantity !== null && input.parsed?.quantity !== undefined
      ? input.parsed.quantity
      : input.quantity.amount;
  const parsedUnit = input.parsed?.unit ?? requestedUnit;
  const source = 'vision_structured' as const;

  if (
    requestedUnit === null ||
    parsedUnit === null ||
    !Number.isFinite(parsedQuantity) ||
    parsedQuantity <= 0
  ) {
    return unresolvedServing({
      quantity:
        Number.isFinite(parsedQuantity) && parsedQuantity > 0
          ? parsedQuantity
          : null,
      unit: parsedUnit,
      reason: 'invalid_quantity',
      source,
    });
  }

  const food = candidateFood(input.candidate);
  if (
    food.servingQuantity === null ||
    food.servingQuantity <= 0 ||
    food.servingUnit === null ||
    classifyServingUnit(food.servingUnit) === null
  ) {
    return unresolvedServing({
      quantity: parsedQuantity,
      unit: parsedUnit,
      reason: 'invalid_basis',
      source,
    });
  }

  const resolution = resolveServingRequest({
    request: {
      quantity: parsedQuantity,
      unit: parsedUnit,
    },
    basis: {
      quantity: food.servingQuantity,
      unit: food.servingUnit,
    },
    servingOptions: resolutionOptions(food.servingOptions),
  });

  if (
    (resolution.status !== 'exact' && resolution.status !== 'converted') ||
    resolution.requestedQuantity === null ||
    resolution.requestedUnit === null ||
    resolution.multiplier === null
  ) {
    const massEstimate = input.quantity.massEstimateGrams;
    const massConfidence = input.quantity.massEstimateConfidence;
    if (
      massEstimate !== null &&
      massEstimate !== undefined &&
      massConfidence !== null &&
      massConfidence !== undefined &&
      Number.isFinite(massEstimate) &&
      massEstimate > 0
    ) {
      return {
        servingResolution: 'supported',
        userReviewRequired: true,
        resolvedServing: {
          status: 'needs_review',
          quantity: resolution.requestedQuantity,
          unit: resolution.requestedUnit,
          servingOptionId: null,
          multiplier: massEstimate / food.servingQuantity,
          method: null,
          reason: 'low_confidence',
          source: 'vision_structured',
          reviewRequired: true,
          normalizedGrams: massEstimate,
          normalizedGramsConfidence: massConfidence,
          normalizationMethod: 'ai_photo_mass_estimate',
          requiresUserReview: true,
        },
      };
    }
    return unresolvedServing({
      quantity: parsedQuantity,
      unit: parsedUnit,
      reason: 'no_safe_conversion',
      source,
    });
  }

  const method = resolutionMethod({
    requestUnit: resolution.requestedUnit,
    requestFamily: resolution.requestedUnitFamily,
    servingOptionId: resolution.servingOptionId,
  });
  const lowConfidence = input.quantity.confidence === 'low';
  const normalizedGrams = resolution.resolvedWeightGrams;
  const normalizationMethod =
    normalizedGrams === null
      ? undefined
      : resolution.servingOptionId !== null
        ? 'provider_serving_conversion'
        : resolution.requestedUnit === 'g'
          ? 'direct_grams'
          : 'deterministic_mass_conversion';
  return {
    servingResolution: 'supported',
    userReviewRequired: lowConfidence,
    resolvedServing: {
      status: lowConfidence ? 'needs_review' : 'resolved',
      quantity: resolution.requestedQuantity,
      unit: resolution.requestedUnit,
      servingOptionId: resolution.servingOptionId,
      multiplier: resolution.multiplier,
      method,
      reason: lowConfidence ? 'low_confidence' : null,
      source:
        method === 'provider_serving'
          ? 'provider_serving'
          : 'deterministic_conversion',
      reviewRequired: lowConfidence,
      normalizedGrams,
      normalizedGramsConfidence: input.quantity.confidence,
      ...(normalizationMethod === undefined ? {} : { normalizationMethod }),
      requiresUserReview: lowConfidence,
    },
  };
}
