import {
  photoAnalysisResultSchema,
  resolveServingRequest,
  type AiFoodParseCandidate,
  type AiFoodParsedItem,
  type FoodItemServingOptions,
  type PhotoAnalysisResult,
  type PhotoRecognizedItem,
  type PhotoServingResolution,
  type PhotoUnresolvedReason,
} from '@food-tracker/shared';
import {
  bestTrustedCandidate,
  parseCandidateId,
} from '../foodItems/candidate-ranking.js';
import { retrieveParsedFoodItems } from './retrieval.js';
import type { PhotoAnalysisConfig } from './photo-config.js';
import {
  parsePhotoServingText,
  photoAnalysisProvider,
  type ProviderPhotoSuggestion,
} from './photo-provider.js';

function candidateFood(candidate: AiFoodParseCandidate) {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem
    : candidate.externalFood;
}

function resolutionOptions(options: FoodItemServingOptions | null) {
  return (
    options?.options.map((option) => ({
      id: option.id,
      label: option.label,
      quantity: option.quantity,
      unit: option.unit,
      equivalentWeightGrams: option.equivalentWeightGrams,
      equivalentVolumeMl: option.equivalentVolumeMl,
      source:
        option.source === 'provider'
          ? ('provider' as const)
          : ('manual' as const),
      trust: 'trusted' as const,
      providerDescription: option.providerDescription,
    })) ?? []
  );
}

function validatePortionAgainstCandidate(
  candidate: AiFoodParseCandidate | undefined,
  suggestion: ReturnType<typeof parsePhotoServingText>,
): PhotoServingResolution {
  if (suggestion.status === 'missing') return 'not_attempted';
  if (suggestion.status !== 'parsed' || candidate === undefined) {
    return 'needs_review';
  }

  const food = candidateFood(candidate);
  if (food.servingQuantity === null || food.servingUnit === null) {
    return 'needs_review';
  }

  const resolution = resolveServingRequest({
    request: {
      quantity: suggestion.quantity,
      unit: suggestion.unit,
    },
    basis: {
      quantity: food.servingQuantity,
      unit: food.servingUnit,
    },
    servingOptions: resolutionOptions(food.servingOptions),
  });

  return resolution.status === 'exact' || resolution.status === 'converted'
    ? 'supported'
    : 'needs_review';
}

function candidateIsAmbiguous(candidates: AiFoodParseCandidate[]): boolean {
  const first = candidates[0];
  const second = candidates[1];
  return (
    first !== undefined &&
    second !== undefined &&
    first.confidence === second.confidence &&
    first.confidence !== 'low'
  );
}

function duplicateKey(suggestion: ProviderPhotoSuggestion): string {
  return [
    suggestion.name.trim().toLocaleLowerCase(),
    suggestion.preparationForm?.trim().toLocaleLowerCase() ?? '',
    suggestion.quantityText?.trim().toLocaleLowerCase() ?? '',
    suggestion.servingText?.trim().toLocaleLowerCase() ?? '',
  ].join('|');
}

function unresolvedReason(input: {
  identityConfidence: PhotoRecognizedItem['identityConfidence'];
  duplicate: boolean;
  candidates: AiFoodParseCandidate[];
  selectedCandidate: AiFoodParseCandidate | undefined;
  portionResolution: PhotoServingResolution;
}): PhotoUnresolvedReason | null {
  if (input.identityConfidence === 'low') return 'low_identity_confidence';
  if (input.duplicate) return 'ambiguous_identity';
  if (input.selectedCandidate === undefined) {
    return input.candidates.length === 0
      ? 'no_trusted_candidate'
      : 'low_candidate_confidence';
  }
  if (input.portionResolution !== 'supported') return 'portion_needs_review';
  return null;
}

function buildRow(input: {
  index: number;
  suggestion: ProviderPhotoSuggestion;
  retrieved: AiFoodParsedItem;
  duplicate: boolean;
}): PhotoRecognizedItem {
  const parsed = parsePhotoServingText({
    quantityText: input.suggestion.quantityText,
    servingText: input.suggestion.servingText,
  });
  const trusted = bestTrustedCandidate(
    input.retrieved.parsedName,
    input.retrieved.candidates,
  );
  const ambiguous = candidateIsAmbiguous(input.retrieved.candidates);
  const selectedCandidate =
    input.suggestion.identityConfidence === 'low' ||
    input.duplicate ||
    ambiguous
      ? undefined
      : trusted;
  const portionResolution = validatePortionAgainstCandidate(
    selectedCandidate,
    parsed,
  );
  const reason = unresolvedReason({
    identityConfidence: input.suggestion.identityConfidence,
    duplicate: input.duplicate,
    candidates: input.retrieved.candidates,
    selectedCandidate,
    portionResolution,
  });
  const selectedCandidateId =
    selectedCandidate === undefined
      ? null
      : parseCandidateId(selectedCandidate);
  const loggable = selectedCandidateId !== null && reason === null;
  const provisionalPortion =
    input.suggestion.quantityText !== null ||
    input.suggestion.servingText !== null
      ? {
          rawQuantityText: input.suggestion.quantityText,
          rawServingText: input.suggestion.servingText,
          confidence: input.suggestion.portionConfidence ?? 'low',
          parsed,
          servingResolution: portionResolution,
        }
      : null;

  return {
    id: `photo-item-${input.index + 1}` as PhotoRecognizedItem['id'],
    recognizedName: input.suggestion.name,
    preparationForm: input.suggestion.preparationForm,
    identityConfidence: input.suggestion.identityConfidence,
    portionConfidence: input.suggestion.portionConfidence,
    region: input.suggestion.region,
    provisionalPortion,
    reviewStatus:
      input.retrieved.candidates.length === 0
        ? 'unmatched'
        : loggable
          ? 'matched'
          : 'needs_review',
    selectedCandidateId,
    loggable,
    candidates: input.retrieved.candidates,
    unresolvedReason: reason,
  };
}

export async function analyzePhotoFood(input: {
  image: Uint8Array;
  userId: string;
  rateLimitKey: string;
  signal: AbortSignal;
  config: PhotoAnalysisConfig;
}): Promise<PhotoAnalysisResult> {
  const provider = photoAnalysisProvider(input.config);
  const suggestions = await provider.analyze({
    image: input.image,
    mimeType: 'image/jpeg',
    signal: input.signal,
  });

  if (suggestions.length === 0) {
    return { status: 'no_food_detected', items: [] };
  }

  const retrieved = await retrieveParsedFoodItems({
    userId: input.userId,
    rateLimitKey: `${input.rateLimitKey}:photo`,
    parsedItems: suggestions.map((suggestion) => ({
      name: [suggestion.name, suggestion.preparationForm]
        .filter((value): value is string => value !== null)
        .join(' '),
      quantityText: suggestion.quantityText,
      servingText: suggestion.servingText,
    })),
  });

  const seen = new Set<string>();
  const items = suggestions.map((suggestion, index) => {
    const key = duplicateKey(suggestion);
    const duplicate = seen.has(key);
    seen.add(key);
    const retrievedItem = retrieved[index];
    if (retrievedItem === undefined) {
      throw new Error('Photo retrieval returned fewer rows than recognition.');
    }
    return buildRow({
      index,
      suggestion,
      retrieved: retrievedItem,
      duplicate,
    });
  });

  const result: PhotoAnalysisResult = {
    status: 'recognized',
    items,
  };
  photoAnalysisResultSchema.parse(result);
  return result;
}
