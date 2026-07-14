import {
  photoAnalysisResultSchema,
  resolveServingRequest,
  type AiFoodParseCandidate,
  type AiFoodParsedItem,
  type FoodItemServingOptions,
  type PhotoAnalysisResult,
  type PhotoAdjudicationMetadata,
  type PhotoRecognizedItem,
  type PhotoServingResolution,
  type PhotoUnresolvedReason,
  type ParsedServingSuggestion,
} from '@food-tracker/shared';
import {
  bestTrustedCandidate,
  hasRelevantTrustedCandidate,
  normalizeText,
  parseCandidateId,
} from '../foodItems/candidate-ranking.js';
import { retrieveParsedFoodItems } from './retrieval.js';
import type { PhotoAnalysisConfig } from './photo-config.js';
import {
  parsePhotoServingText,
  photoAnalysisProvider,
  type ProviderPhotoQuantity,
  type ProviderPhotoSuggestion,
} from './photo-provider.js';
import {
  adaptPhotoRepresentations,
  representationMetadataForRow,
  type AdaptedPhotoRepresentationItem,
} from './photo-representation.js';
import {
  photoCandidateAdjudicationProvider,
  type PhotoAdjudicationCandidateSummary,
  type PhotoAdjudicationRequest,
  type PhotoAdjudicationResult,
} from './photo-candidate-adjudication.js';

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
  suggestion: ParsedServingSuggestion | null,
): PhotoServingResolution {
  if (suggestion === null || suggestion.status === 'missing')
    return 'not_attempted';
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

function candidateIsStrongDeterministic(
  query: string,
  candidates: AiFoodParseCandidate[],
): boolean {
  const first = candidates[0];
  if (first === undefined) return false;
  const food = candidateFood(first);
  return (
    normalizeText(food.name) === normalizeText(query) &&
    hasRelevantTrustedCandidate({ parsedName: query, candidate: first })
  );
}

function duplicateKey(suggestion: ProviderPhotoSuggestion): string {
  return [
    suggestion.name.trim().toLocaleLowerCase(),
    suggestion.preparationForm?.trim().toLocaleLowerCase() ?? '',
    suggestion.quantity.quantityState,
    suggestion.quantity.quantityAmount?.toString() ?? '',
    suggestion.quantity.quantityUnit ?? '',
    suggestion.quantity.quantityCountLabel?.trim().toLocaleLowerCase() ?? '',
  ].join('|');
}

function canonicalServingUnit(quantity: ProviderPhotoQuantity): string | null {
  if (quantity.quantityState !== 'estimated') return null;
  if (quantity.quantityUnit === 'count') {
    switch (quantity.quantityCountLabel?.trim().toLocaleLowerCase()) {
      case 'egg':
        return 'egg';
      case 'slice':
        return 'slice';
      case 'bar':
        return 'bar';
      default:
        return null;
    }
  }
  switch (quantity.quantityUnit) {
    case 'slice':
      return 'slice';
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
    case 'piece':
      return null;
  }
}

function parsedServingForQuantity(
  quantity: ProviderPhotoQuantity,
): ParsedServingSuggestion {
  if (quantity.quantityState === 'no_responsible_estimate') {
    return parsePhotoServingText({ quantityText: null, servingText: null });
  }

  const unit = canonicalServingUnit(quantity);
  if (unit === null) {
    return {
      status: 'needs_review',
      quantity: quantity.quantityAmount,
      unit: null,
      reason: 'unsupported_serving_text',
      rawQuantityText: quantity.quantityRawText,
      rawServingText: null,
    };
  }

  return parsePhotoServingText({
    quantityText: String(quantity.quantityAmount),
    servingText: `${quantity.quantityAmount} ${unit}`,
  });
}

function retrievalServingText(quantity: ProviderPhotoQuantity): {
  quantityText: string | null;
  servingText: string | null;
} {
  if (quantity.quantityState === 'no_responsible_estimate') {
    return { quantityText: null, servingText: null };
  }

  const unit = canonicalServingUnit(quantity);
  if (unit === null) {
    return {
      quantityText: null,
      servingText: quantity.quantityCountLabel,
    };
  }

  return {
    quantityText: String(quantity.quantityAmount),
    servingText: `${quantity.quantityAmount} ${unit}`,
  };
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
  representation: AdaptedPhotoRepresentationItem;
  adjudication?: PhotoAdjudicationMetadata;
}): PhotoRecognizedItem {
  const quantityParsed = parsedServingForQuantity(input.suggestion.quantity);
  const trusted = bestTrustedCandidate(
    input.retrieved.parsedName,
    input.retrieved.candidates,
  );
  const ambiguous = candidateIsAmbiguous(input.retrieved.candidates);
  const strongDeterministic = candidateIsStrongDeterministic(
    input.retrieved.parsedName,
    input.retrieved.candidates,
  );
  const selectedCandidate =
    input.suggestion.identityConfidence === 'low' ||
    input.duplicate ||
    (ambiguous && !strongDeterministic)
      ? undefined
      : trusted;
  const portionResolution = validatePortionAgainstCandidate(
    selectedCandidate,
    quantityParsed,
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
  const provisionalPortion = {
    rawQuantityText:
      input.suggestion.quantity.quantityState === 'estimated'
        ? input.suggestion.quantity.quantityRawText
        : null,
    rawServingText: null,
    confidence:
      input.suggestion.quantity.quantityState === 'estimated'
        ? input.suggestion.quantity.quantityConfidence
        : null,
    parsed: quantityParsed,
    quantity:
      input.suggestion.quantity.quantityState === 'estimated'
        ? {
            state: 'estimated' as const,
            amount: input.suggestion.quantity.quantityAmount,
            unit: input.suggestion.quantity.quantityUnit,
            countLabel: input.suggestion.quantity.quantityCountLabel,
            rawText: input.suggestion.quantity.quantityRawText,
            confidence: input.suggestion.quantity.quantityConfidence,
          }
        : { state: 'no_responsible_estimate' as const },
    servingResolution: portionResolution,
  };

  return {
    id: `photo-item-${input.index + 1}` as PhotoRecognizedItem['id'],
    recognizedName: input.suggestion.name,
    preparationForm: input.suggestion.preparationForm,
    identityConfidence: input.suggestion.identityConfidence,
    portionConfidence:
      input.suggestion.quantity.quantityState === 'estimated'
        ? input.suggestion.quantity.quantityConfidence
        : null,
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
    ...representationMetadataForRow(input.representation),
    adjudication: input.adjudication ?? {
      selectionSource:
        selectedCandidateId !== null ? 'deterministic' : 'user_required',
      status: 'not_needed',
      confidence: null,
      reviewReason: reason,
    },
  };
}

function adjudicationCandidateSummary(
  candidate: AiFoodParseCandidate,
  candidateRef: string,
): PhotoAdjudicationCandidateSummary {
  const food = candidateFood(candidate);
  return {
    candidateRef,
    displayName: food.name,
    brandName: food.brandName,
    preparationForm: null,
    foodType: food.foodType,
    source: candidate.matchReason,
    servingLabels:
      food.servingOptions?.options
        .map((option) => option.providerDescription ?? option.label)
        .slice(0, 6) ?? [],
  };
}

interface PreparedAdjudication {
  request: PhotoAdjudicationRequest;
  candidateMaps: Map<string, Map<string, AiFoodParseCandidate>>;
}

function prepareAdjudication(
  rows: PhotoRecognizedItem[],
  config: PhotoAnalysisConfig,
): PreparedAdjudication {
  const candidateMaps = new Map<string, Map<string, AiFoodParseCandidate>>();
  const requestRows: PhotoAdjudicationRequest['rows'] = [];

  for (const row of rows) {
    if (
      row.selectedCandidateId !== null ||
      row.identityConfidence === 'low' ||
      row.unresolvedReason === 'ambiguous_identity'
    ) {
      continue;
    }

    const query = [row.recognizedName, row.preparationForm]
      .filter((value): value is string => value !== null)
      .join(' ');
    const eligibleCandidates = row.candidates
      .filter((candidate) => {
        if (!hasRelevantTrustedCandidate({ parsedName: query, candidate })) {
          return false;
        }
        return (
          validatePortionAgainstCandidate(
            candidate,
            row.provisionalPortion?.parsed ?? null,
          ) !== 'needs_review'
        );
      })
      .slice(0, config.candidateAdjudicationMaxCandidates);
    if (eligibleCandidates.length === 0) continue;

    const candidateMap = new Map<string, AiFoodParseCandidate>();
    const candidates = eligibleCandidates.map((candidate, index) => {
      const candidateRef = `candidate-${row.id.replace('photo-item-', '')}-${index + 1}`;
      candidateMap.set(candidateRef, candidate);
      return adjudicationCandidateSummary(candidate, candidateRef);
    });
    candidateMaps.set(row.id, candidateMap);
    requestRows.push({
      recognitionRef: row.id,
      recognizedName: row.recognizedName,
      preparationForm: row.preparationForm,
      quantity: row.provisionalPortion?.quantity ?? {
        state: 'no_responsible_estimate',
      },
      representationKind: row.representationKind,
      coverage: row.coverage,
      visiblePortionDescription: row.visiblePortionDescription,
      candidates,
    });
    if (requestRows.length >= config.candidateAdjudicationMaxRows) break;
  }

  return {
    request: { rows: requestRows },
    candidateMaps,
  };
}

function adjudicationMetadata(input: {
  status: PhotoAdjudicationMetadata['status'];
  confidence?: PhotoAdjudicationMetadata['confidence'];
  selectionSource?: PhotoAdjudicationMetadata['selectionSource'];
  reviewReason?: string | null;
}): PhotoAdjudicationMetadata {
  return {
    selectionSource: input.selectionSource ?? 'user_required',
    status: input.status,
    confidence: input.confidence ?? null,
    reviewReason: input.reviewReason ?? null,
  };
}

function applyAdjudication(
  rows: PhotoRecognizedItem[],
  prepared: PreparedAdjudication,
  result: PhotoAdjudicationResult,
): PhotoRecognizedItem[] {
  const decisions =
    result.status === 'completed'
      ? new Map(
          result.decisions.map((decision) => [
            decision.recognitionRef,
            decision,
          ]),
        )
      : null;

  return rows.map((row) => {
    const candidateMap = prepared.candidateMaps.get(row.id);
    if (candidateMap === undefined) return row;

    if (result.status !== 'completed') {
      return {
        ...row,
        adjudication: adjudicationMetadata({
          status: result.status,
          reviewReason:
            result.status === 'unavailable'
              ? 'adjudication_unavailable'
              : 'adjudication_invalid_response',
        }),
      };
    }

    const decision = decisions?.get(row.id);
    if (decision === undefined) {
      return {
        ...row,
        adjudication: adjudicationMetadata({
          status: 'no_decision',
          reviewReason: 'adjudication_missing_decision',
        }),
      };
    }

    if (decision.decision === 'select_candidate') {
      const candidate = candidateMap.get(decision.candidateRef);
      if (candidate === undefined) return row;
      if (decision.confidence !== 'high') {
        return {
          ...row,
          adjudication: adjudicationMetadata({
            status: 'selected',
            confidence: decision.confidence,
            reviewReason: 'adjudication_confidence_requires_review',
          }),
        };
      }

      const portionResolution = validatePortionAgainstCandidate(
        candidate,
        row.provisionalPortion?.parsed ?? null,
      );
      const selectedCandidateId = parseCandidateId(candidate);
      const loggable = portionResolution === 'supported';
      return {
        ...row,
        selectedCandidateId,
        loggable,
        reviewStatus: loggable
          ? ('matched' as const)
          : ('needs_review' as const),
        unresolvedReason: loggable ? null : ('portion_needs_review' as const),
        adjudication: adjudicationMetadata({
          status: 'selected',
          confidence: 'high',
          selectionSource: 'ai_adjudicated',
          reviewReason: loggable ? null : 'portion_needs_review',
        }),
      };
    }

    if (decision.decision === 'reject_all') {
      return {
        ...row,
        adjudication: adjudicationMetadata({
          status: 'rejected_all',
          confidence: decision.confidence,
          reviewReason:
            decision.confidence === 'high'
              ? 'adjudication_rejected_all'
              : 'adjudication_rejection_requires_review',
        }),
      };
    }

    return {
      ...row,
      adjudication: adjudicationMetadata({
        status: 'no_decision',
        reviewReason: 'adjudication_no_decision',
      }),
    };
  });
}

async function adjudicateRows(input: {
  rows: PhotoRecognizedItem[];
  config: PhotoAnalysisConfig;
  signal: AbortSignal;
}): Promise<PhotoRecognizedItem[]> {
  if (!input.config.candidateAdjudicationEnabled) return input.rows;
  const prepared = prepareAdjudication(input.rows, input.config);
  if (prepared.request.rows.length === 0) return input.rows;

  const provider = photoCandidateAdjudicationProvider({
    provider: input.config.provider,
    geminiApiKey: input.config.geminiApiKey,
    geminiModel: input.config.geminiModel,
    timeoutMs: input.config.candidateAdjudicationTimeoutMs,
    maxCandidates: input.config.candidateAdjudicationMaxCandidates,
    maxRows: input.config.candidateAdjudicationMaxRows,
    maxOutputTokens: input.config.candidateAdjudicationMaxOutputTokens,
    mockDecision: input.config.candidateAdjudicationMockDecision,
  });
  const result = await provider.adjudicate({
    request: prepared.request,
    signal: input.signal,
  });
  return applyAdjudication(input.rows, prepared, result);
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
    return {
      status: 'no_food_detected',
      items: [],
      representationGroups: [],
    };
  }

  const representations = adaptPhotoRepresentations(suggestions);

  const retrieved = await retrieveParsedFoodItems({
    userId: input.userId,
    rateLimitKey: `${input.rateLimitKey}:photo`,
    parsedItems: representations.active.map(({ suggestion }) => ({
      name: [suggestion.name, suggestion.preparationForm]
        .filter((value): value is string => value !== null)
        .join(' '),
      ...retrievalServingText(suggestion.quantity),
    })),
  });

  const seen = new Set<string>();
  const initialItems = representations.active.map((representation, index) => {
    const { suggestion } = representation;
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
      representation,
    });
  });

  const items = await adjudicateRows({
    rows: initialItems,
    config: input.config,
    signal: input.signal,
  });

  const result: PhotoAnalysisResult = {
    status: 'recognized',
    items,
    representationGroups: representations.groups,
  };
  photoAnalysisResultSchema.parse(result);
  return result;
}
