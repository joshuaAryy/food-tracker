import {
  photoAnalysisResultSchema,
  resolveServingRequest,
  type AiFoodParseCandidate,
  type AiFoodParsedItem,
  type FoodItem,
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
  rankParseCandidates,
  rankableFromParseCandidate,
  scoreFoodCandidate,
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
import {
  buildPhotoNutritionEstimate,
  type PhotoNutritionEstimateValues,
} from './photo-nutrition-estimate.js';
import { issuePhotoEstimateProof } from './photo-estimate-proof.js';
import { prisma } from '../../lib/prisma.js';
import { serializeFoodItem } from '../../lib/serializers.js';
import {
  findOrCreateExternalFoodItem,
  withExternalFoodMaterializationLock,
} from '../foodItems/external-food.js';
import { usdaFdcConfig } from '../foodItems/usda-fdc.js';
import {
  resolvePhotoQuantityAgainstCandidate,
  photoQuantityUnitToServingUnit,
} from './photo-serving-resolution.js';

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
  options: { allowMissing?: boolean } = {},
): PhotoServingResolution {
  if (suggestion === null || suggestion.status === 'missing')
    return options.allowMissing === true ? 'not_attempted' : 'needs_review';
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

function resolvePhotoPortionForCandidate(
  portion: PhotoRecognizedItem['provisionalPortion'],
  candidate: AiFoodParseCandidate | undefined,
): {
  portion: PhotoRecognizedItem['provisionalPortion'];
  servingResolution: PhotoServingResolution;
  userReviewRequired: boolean;
} {
  if (portion === null || candidate === undefined) {
    return {
      portion,
      servingResolution: 'needs_review',
      userReviewRequired: true,
    };
  }

  const resolution = resolvePhotoQuantityAgainstCandidate({
    candidate,
    quantity: portion.quantity,
    parsed: portion.parsed,
  });
  return {
    portion: {
      ...portion,
      servingResolution: resolution.servingResolution,
      resolvedServing: resolution.resolvedServing,
    },
    servingResolution: resolution.servingResolution,
    userReviewRequired: resolution.userReviewRequired,
  };
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

type ExternalPhotoCandidate = Extract<
  AiFoodParseCandidate,
  { candidateType: 'external_food' }
>;

const AUTOMATIC_EXTERNAL_MIN_SCORE_MARGIN = 20;

export interface AutomaticExternalResolutionDiagnostic {
  rowIndex: number;
  localCandidateCount: number;
  externalCandidateCount: number;
  winnerSourceCategory: 'local' | 'external' | 'none';
  winnerConfidenceCategory: AiFoodParseCandidate['confidence'] | 'none';
  scoreMarginCategory: 'clear' | 'ambiguous' | 'none';
  adjudicationResult: PhotoAdjudicationMetadata['status'] | 'none';
  adjudicationConfidence: PhotoAdjudicationMetadata['confidence'];
  selectedCandidateReferenceValid: boolean;
  selectedCandidateSelectionEligible: boolean | null;
  deterministicAdjudicationConflict: boolean;
  agreesWithDeterministicTop: boolean | null;
  externalAvailabilityState: 'available' | 'unavailable' | 'none';
  materializationEligible: boolean;
  materializationSuppressionReason: string | null;
  materializationSuccess: boolean;
  identityMaterializationEligible?: boolean;
  identityMaterializationSuccess?: boolean;
  servingResolutionStatus?: PhotoServingResolution;
  servingReviewRequired?: boolean;
  identitySuppressionReason?: string | null;
  servingResolutionFailureReason?: string | null;
  candidateFamilyCount: number;
  candidates: Array<{
    candidateIndex: number;
    sourceCategory: 'local' | 'external';
    availability: 'available' | 'unavailable';
    searchRank: number;
    confidenceCategory: AiFoodParseCandidate['confidence'];
    normalizedNameSimilarity: 'exact' | 'near' | 'partial' | 'none';
    preparationCompatibility: 'compatible' | 'uncertain' | 'mismatch';
    brandedGenericCompatibility: 'compatible' | 'uncertain' | 'mismatch';
    sourceReliability: 'canonical' | 'provider';
    scoreCategory: 'high' | 'medium' | 'low';
    distanceFromTop: 'top' | 'near' | 'far';
    selectionEligible: boolean;
    nutritionComplete: boolean;
    servingComplete: boolean;
    materializationCompatible: boolean;
    detailLookup: 'complete' | 'unavailable' | 'unknown';
    canonicalLocalEquivalentExists: boolean;
    exclusionReason: string | null;
  }>;
}

function externalCandidateForRow(
  row: PhotoRecognizedItem,
): ExternalPhotoCandidate | undefined {
  if (row.selectedCandidateId === null) return undefined;
  return row.candidates.find(
    (candidate): candidate is ExternalPhotoCandidate =>
      candidate.candidateType === 'external_food' &&
      parseCandidateId(candidate) === row.selectedCandidateId,
  );
}

function queryForPhotoRow(row: PhotoRecognizedItem): string {
  return [row.recognizedName, row.preparationForm]
    .filter((value): value is string => value !== null)
    .join(' ');
}

function externalCandidateAvailability(
  candidate: ExternalPhotoCandidate | undefined,
): 'available' | 'unavailable' | 'none' {
  if (candidate === undefined) return 'none';
  const food = candidate.externalFood;
  return food.calories !== null && food.protein !== null
    ? 'available'
    : 'unavailable';
}

function candidateFamilyKey(candidate: AiFoodParseCandidate): string {
  const food = candidateFood(candidate);
  const identity = normalizeText(food.name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
    .sort()
    .join(' ');
  return [
    candidate.matchReason,
    food.foodType,
    identity,
    food.servingUnit ?? '',
    food.servingWeightGrams?.toString() ?? '',
  ].join('|');
}

function candidateScoreCategory(score: number): 'high' | 'medium' | 'low' {
  if (score >= 220) return 'high';
  if (score >= 140) return 'medium';
  return 'low';
}

function candidateDiagnostics(input: {
  query: string;
  ranked: AiFoodParseCandidate[];
}): {
  candidates: AutomaticExternalResolutionDiagnostic['candidates'];
  candidateFamilyCount: number;
} {
  const scored = input.ranked.map((candidate, candidateIndex) => {
    const score = scoreFoodCandidate({
      query: input.query,
      candidate: rankableFromParseCandidate(candidate),
    });
    return {
      candidate,
      candidateIndex,
      score,
      numericScore: score.score,
      familyKey: candidateFamilyKey(candidate),
    };
  });
  const topScore = scored[0]?.numericScore ?? 0;
  return {
    candidateFamilyCount: new Set(scored.map((item) => item.familyKey)).size,
    candidates: scored.slice(0, 3).map((item) => {
      const food = candidateFood(item.candidate);
      const distance = topScore - item.numericScore;
      return {
        candidateIndex: item.candidateIndex,
        sourceCategory:
          item.candidate.candidateType === 'food_item'
            ? ('local' as const)
            : ('external' as const),
        availability:
          food.calories !== null && food.protein !== null
            ? ('available' as const)
            : ('unavailable' as const),
        searchRank: item.candidate.rank,
        confidenceCategory: item.candidate.confidence,
        normalizedNameSimilarity:
          normalizeText(food.name) === normalizeText(input.query)
            ? ('exact' as const)
            : item.score.allCoreTokensMatch
              ? ('near' as const)
              : item.score.visibleRelevant
                ? ('partial' as const)
                : ('none' as const),
        preparationCompatibility: item.score.allRequestedDescriptorsMatch
          ? ('compatible' as const)
          : item.score.penalties.includes('negative_descriptor')
            ? ('mismatch' as const)
            : ('uncertain' as const),
        brandedGenericCompatibility: item.score.penalties.includes(
          'branded_mismatch',
        )
          ? ('mismatch' as const)
          : food.foodType === 'generic'
            ? ('compatible' as const)
            : ('uncertain' as const),
        sourceReliability:
          item.candidate.candidateType === 'food_item'
            ? ('canonical' as const)
            : ('provider' as const),
        scoreCategory: candidateScoreCategory(item.numericScore),
        distanceFromTop:
          distance === 0
            ? ('top' as const)
            : distance < 20
              ? ('near' as const)
              : ('far' as const),
        selectionEligible: item.score.selectionEligible,
        nutritionComplete: food.calories !== null && food.protein !== null,
        servingComplete:
          food.servingQuantity !== null && food.servingUnit !== null,
        materializationCompatible:
          item.candidate.candidateType === 'external_food' &&
          food.calories !== null &&
          food.protein !== null &&
          food.servingQuantity !== null &&
          food.servingUnit !== null &&
          item.score.selectionEligible,
        detailLookup:
          item.candidate.candidateType === 'external_food'
            ? food.calories !== null && food.protein !== null
              ? ('complete' as const)
              : ('unavailable' as const)
            : ('unknown' as const),
        canonicalLocalEquivalentExists: input.ranked.some(
          (other) =>
            other.candidateType === 'food_item' &&
            item.candidate.candidateType === 'external_food' &&
            other.foodItem.sourceProvider ===
              item.candidate.externalFood.sourceProvider &&
            other.foodItem.sourceId === item.candidate.externalFood.sourceId,
        ),
        exclusionReason: item.score.selectionEligible
          ? null
          : (item.score.penalties[0] ??
            (item.score.loggable
              ? 'selection_ineligible'
              : 'incomplete_nutrition')),
      };
    }),
  };
}

function candidateFamilyRepresentatives(
  candidates: AiFoodParseCandidate[],
): AiFoodParseCandidate[] {
  const representatives = new Map<string, AiFoodParseCandidate>();
  for (const candidate of candidates) {
    const key = candidateFamilyKey(candidate);
    if (!representatives.has(key)) representatives.set(key, candidate);
  }
  return [...representatives.values()];
}

function automaticExternalWinner(input: {
  row: PhotoRecognizedItem;
  rowIndex: number;
  diagnostics?: (diagnostic: AutomaticExternalResolutionDiagnostic) => void;
}): ExternalPhotoCandidate | undefined {
  const query = queryForPhotoRow(input.row);
  const ranked = rankParseCandidates(query, input.row.candidates);
  const familyRanked = candidateFamilyRepresentatives(ranked);
  const rankedDiagnostics = candidateDiagnostics({ query, ranked });
  const first = ranked[0];
  const selectedExternal = externalCandidateForRow(input.row);
  const external =
    selectedExternal ??
    (first?.candidateType === 'external_food' ? first : undefined);
  const externalCandidates = input.row.candidates.filter(
    (candidate) => candidate.candidateType === 'external_food',
  );
  const localCandidates = input.row.candidates.filter(
    (candidate) => candidate.candidateType === 'food_item',
  );
  const scoreMargin =
    familyRanked[0] === undefined || familyRanked[1] === undefined
      ? null
      : scoreFoodCandidate({
          query,
          candidate: rankableFromParseCandidate(familyRanked[0]),
        }).score -
        scoreFoodCandidate({
          query,
          candidate: rankableFromParseCandidate(familyRanked[1]),
        }).score;
  const scoreMarginCategory =
    scoreMargin === null
      ? 'none'
      : scoreMargin < AUTOMATIC_EXTERNAL_MIN_SCORE_MARGIN ||
          candidateIsAmbiguous(familyRanked)
        ? 'ambiguous'
        : 'clear';
  const emit = (
    winner: ExternalPhotoCandidate | undefined,
    eligible: boolean,
    reason: string | null,
  ) => {
    input.diagnostics?.({
      rowIndex: input.rowIndex,
      localCandidateCount: localCandidates.length,
      externalCandidateCount: externalCandidates.length,
      winnerSourceCategory:
        first?.candidateType === 'food_item'
          ? 'local'
          : first?.candidateType === 'external_food'
            ? 'external'
            : 'none',
      winnerConfidenceCategory: first?.confidence ?? 'none',
      scoreMarginCategory,
      adjudicationResult: input.row.adjudication?.status ?? 'none',
      adjudicationConfidence: input.row.adjudication?.confidence ?? null,
      selectedCandidateReferenceValid:
        input.row.adjudication?.status !== 'selected' ||
        selectedExternal !== undefined,
      selectedCandidateSelectionEligible:
        selectedExternal === undefined
          ? null
          : scoreFoodCandidate({
              query,
              candidate: rankableFromParseCandidate(selectedExternal),
            }).selectionEligible,
      deterministicAdjudicationConflict:
        input.row.adjudication?.status === 'selected' &&
        selectedExternal !== undefined &&
        first !== undefined &&
        parseCandidateId(first) !== parseCandidateId(selectedExternal),
      agreesWithDeterministicTop:
        selectedExternal === undefined || first === undefined
          ? null
          : parseCandidateId(first) === parseCandidateId(selectedExternal),
      externalAvailabilityState: externalCandidateAvailability(external),
      materializationEligible: eligible,
      materializationSuppressionReason: reason,
      materializationSuccess: false,
      identityMaterializationEligible: eligible,
      identityMaterializationSuccess: false,
      servingResolutionStatus: 'not_attempted',
      servingReviewRequired: false,
      identitySuppressionReason: reason,
      servingResolutionFailureReason: null,
      ...rankedDiagnostics,
    });
    return winner;
  };

  if (external === undefined) {
    return emit(undefined, false, 'no_selected_external_candidate');
  }
  if (
    external.externalFood.calories === null ||
    external.externalFood.protein === null
  ) {
    return emit(undefined, false, 'external_candidate_unavailable');
  }
  if (
    external.externalFood.servingQuantity === null ||
    external.externalFood.servingUnit === null
  ) {
    return emit(undefined, false, 'external_candidate_incomplete_serving');
  }
  if (input.row.identityConfidence === 'low') {
    return emit(undefined, false, 'identity_confidence_not_high');
  }
  if (input.row.adjudication?.status === 'rejected_all') {
    return emit(undefined, false, 'adjudication_rejected_all');
  }

  const adjudicatedHigh =
    input.row.adjudication?.status === 'selected' &&
    input.row.adjudication.selectionSource === 'ai_adjudicated' &&
    input.row.adjudication.confidence === 'high';
  if (first?.candidateType === 'food_item') {
    return emit(undefined, false, 'local_candidate_wins');
  }
  if (first === undefined) {
    return emit(undefined, false, 'external_candidate_not_ranked_winner');
  }
  if (!adjudicatedHigh && first.confidence !== 'high') {
    return emit(undefined, false, 'external_candidate_confidence_not_high');
  }
  if (
    !adjudicatedHigh &&
    parseCandidateId(first) !== parseCandidateId(external)
  ) {
    return emit(undefined, false, 'external_candidate_not_ranked_winner');
  }
  if (adjudicatedHigh) {
    const selectedScore = scoreFoodCandidate({
      query,
      candidate: rankableFromParseCandidate(external),
    });
    if (!selectedScore.selectionEligible) {
      return emit(undefined, false, 'adjudicated_candidate_not_eligible');
    }
  }
  const deterministicHigh =
    candidateIsStrongDeterministic(query, familyRanked) &&
    (scoreMargin === null ||
      scoreMargin >= AUTOMATIC_EXTERNAL_MIN_SCORE_MARGIN) &&
    !candidateIsAmbiguous(familyRanked);
  if (!adjudicatedHigh && !deterministicHigh) {
    return emit(undefined, false, 'external_candidate_not_clear_winner');
  }
  emit(external, true, null);
  return external;
}

export async function resolveAutomaticExternalCandidates(input: {
  rows: PhotoRecognizedItem[];
  materialize: (candidate: ExternalPhotoCandidate) => Promise<FoodItem>;
  diagnostics?: (diagnostic: AutomaticExternalResolutionDiagnostic) => void;
}): Promise<PhotoRecognizedItem[]> {
  const resolved: PhotoRecognizedItem[] = [];
  for (const [rowIndex, row] of input.rows.entries()) {
    const candidate = automaticExternalWinner({
      row,
      rowIndex,
      ...(input.diagnostics === undefined
        ? {}
        : { diagnostics: input.diagnostics }),
    });
    if (candidate === undefined) {
      const selectedExternal = externalCandidateForRow(row);
      resolved.push(
        selectedExternal === undefined || row.selectedCandidateId === null
          ? row
          : {
              ...row,
              selectedCandidateId: null,
              loggable: false,
              reviewStatus: 'needs_review',
              unresolvedReason: 'low_candidate_confidence',
            },
      );
      continue;
    }

    try {
      const foodItem = await input.materialize(candidate);
      if (
        foodItem.calories === null ||
        foodItem.protein === null ||
        foodItem.servingQuantity === null ||
        foodItem.servingUnit === null
      ) {
        throw new Error('Materialized external FoodItem is incomplete.');
      }
      const canonicalCandidate: AiFoodParseCandidate = {
        candidateType: 'food_item',
        foodItem,
        externalFood: null,
        rank: 1,
        matchReason: candidate.matchReason,
        confidence: 'high',
        defaultServingMultiplier: candidate.defaultServingMultiplier,
      };
      const resolvedPortion = resolvePhotoPortionForCandidate(
        row.provisionalPortion,
        canonicalCandidate,
      );
      const portionResolution = resolvedPortion.servingResolution;
      const loggable =
        portionResolution === 'supported' &&
        !resolvedPortion.userReviewRequired;
      const rowWithoutEstimate = { ...row };
      delete rowWithoutEstimate.estimatedNutrition;
      const nextRow: PhotoRecognizedItem = {
        ...rowWithoutEstimate,
        provisionalPortion: resolvedPortion.portion,
        candidates: [
          ...row.candidates.filter(
            (item) => parseCandidateId(item) !== foodItem.id,
          ),
          canonicalCandidate,
        ],
        selectedCandidateId: foodItem.id,
        loggable,
        reviewStatus: loggable ? 'matched' : 'needs_review',
        unresolvedReason: loggable ? null : 'portion_needs_review',
        adjudication: {
          selectionSource: row.adjudication?.selectionSource ?? 'deterministic',
          status: 'selected',
          confidence: 'high',
          reviewReason: loggable ? null : 'portion_needs_review',
        },
      };
      input.diagnostics?.({
        rowIndex,
        localCandidateCount: row.candidates.filter(
          (item) => item.candidateType === 'food_item',
        ).length,
        externalCandidateCount: row.candidates.filter(
          (item) => item.candidateType === 'external_food',
        ).length,
        winnerSourceCategory: 'external',
        winnerConfidenceCategory: candidate.confidence,
        scoreMarginCategory: 'clear',
        adjudicationResult: row.adjudication?.status ?? 'none',
        adjudicationConfidence: row.adjudication?.confidence ?? null,
        selectedCandidateReferenceValid: true,
        selectedCandidateSelectionEligible: true,
        deterministicAdjudicationConflict: false,
        agreesWithDeterministicTop: true,
        externalAvailabilityState: 'available',
        materializationEligible: true,
        materializationSuppressionReason: null,
        materializationSuccess: true,
        identityMaterializationEligible: true,
        identityMaterializationSuccess: true,
        servingResolutionStatus: portionResolution,
        servingReviewRequired: !loggable,
        identitySuppressionReason: null,
        servingResolutionFailureReason:
          resolvedPortion.portion?.resolvedServing?.reason ?? null,
        candidateFamilyCount: 1,
        candidates: [],
      });
      resolved.push(nextRow);
    } catch {
      const failedRow: PhotoRecognizedItem = {
        ...row,
        selectedCandidateId: null,
        loggable: false,
        reviewStatus: 'needs_review',
        unresolvedReason: 'low_candidate_confidence',
      };
      if (row.adjudication !== undefined) {
        failedRow.adjudication = {
          ...row.adjudication,
          reviewReason: 'external_materialization_failed',
        };
      }
      resolved.push(failedRow);
      input.diagnostics?.({
        rowIndex,
        localCandidateCount: row.candidates.filter(
          (item) => item.candidateType === 'food_item',
        ).length,
        externalCandidateCount: row.candidates.filter(
          (item) => item.candidateType === 'external_food',
        ).length,
        winnerSourceCategory: 'external',
        winnerConfidenceCategory: candidate.confidence,
        scoreMarginCategory: 'clear',
        adjudicationResult: row.adjudication?.status ?? 'none',
        adjudicationConfidence: row.adjudication?.confidence ?? null,
        selectedCandidateReferenceValid: true,
        selectedCandidateSelectionEligible: true,
        deterministicAdjudicationConflict: false,
        agreesWithDeterministicTop: true,
        externalAvailabilityState: 'available',
        materializationEligible: true,
        materializationSuppressionReason: null,
        materializationSuccess: false,
        identityMaterializationEligible: true,
        identityMaterializationSuccess: false,
        servingResolutionStatus: 'not_attempted',
        servingReviewRequired: false,
        identitySuppressionReason: 'external_materialization_failed',
        servingResolutionFailureReason: null,
        candidateFamilyCount: 1,
        candidates: [],
      });
    }
  }
  return resolved;
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
  return photoQuantityUnitToServingUnit({
    unit: quantity.quantityUnit,
    countLabel: quantity.quantityCountLabel,
  });
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

  const displayUnit =
    quantity.quantityUnit === 'count' && quantity.quantityCountLabel !== null
      ? quantity.quantityCountLabel
      : unit;
  return {
    quantityText: String(quantity.quantityAmount),
    servingText: `${quantity.quantityAmount} ${displayUnit}`,
  };
}

function unresolvedReason(input: {
  identityConfidence: PhotoRecognizedItem['identityConfidence'];
  duplicate: boolean;
  candidates: AiFoodParseCandidate[];
  selectedCandidate: AiFoodParseCandidate | undefined;
  portionResolution: PhotoServingResolution;
  servingReviewRequired: boolean;
}): PhotoUnresolvedReason | null {
  if (input.identityConfidence === 'low') return 'low_identity_confidence';
  if (input.duplicate) return 'ambiguous_identity';
  if (input.selectedCandidate === undefined) {
    return input.candidates.length === 0
      ? 'no_trusted_candidate'
      : 'low_candidate_confidence';
  }
  if (input.servingReviewRequired) return 'portion_needs_review';
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
            source: 'vision_structured' as const,
            ...(input.suggestion.quantity.massEstimateGrams === undefined
              ? {}
              : {
                  massEstimateGrams:
                    input.suggestion.quantity.massEstimateGrams,
                }),
            ...(input.suggestion.quantity.massEstimateConfidence === undefined
              ? {}
              : {
                  massEstimateConfidence:
                    input.suggestion.quantity.massEstimateConfidence,
                }),
          }
        : {
            state: 'no_responsible_estimate' as const,
            source: 'unresolved_visible_portion' as const,
          },
    servingResolution: portionResolution,
  } satisfies NonNullable<PhotoRecognizedItem['provisionalPortion']>;
  const resolvedPortion = resolvePhotoPortionForCandidate(
    provisionalPortion,
    selectedCandidate,
  );
  const reason = unresolvedReason({
    identityConfidence: input.suggestion.identityConfidence,
    duplicate: input.duplicate,
    candidates: input.retrieved.candidates,
    selectedCandidate,
    portionResolution: resolvedPortion.servingResolution,
    servingReviewRequired: resolvedPortion.userReviewRequired,
  });
  const selectedCandidateId =
    selectedCandidate === undefined
      ? null
      : parseCandidateId(selectedCandidate);
  const loggable =
    selectedCandidateId !== null &&
    reason === null &&
    !resolvedPortion.userReviewRequired;

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
    const selectedExternal = externalCandidateForRow(row);
    if (row.selectedCandidateId !== null && selectedExternal === undefined) {
      continue;
    }

    const candidateAdjudicationEligible =
      config.candidateAdjudicationEnabled &&
      row.identityConfidence !== 'low' &&
      row.unresolvedReason !== 'ambiguous_identity';

    const query = [row.recognizedName, row.preparationForm]
      .filter((value): value is string => value !== null)
      .join(' ');
    const eligibleCandidates = candidateAdjudicationEligible
      ? row.candidates
          .filter((candidate) =>
            hasRelevantTrustedCandidate({ parsedName: query, candidate }),
          )
          .slice(0, config.candidateAdjudicationMaxCandidates)
      : [];
    const estimateEligible = config.nutritionEstimationEnabled;
    if (!estimateEligible && eligibleCandidates.length === 0) continue;

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
      estimateBasis:
        row.provisionalPortion?.quantity.state === 'estimated'
          ? 'structured_quantity'
          : 'portion_shown',
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
  pendingEstimates: Map<string, PhotoNutritionEstimateValues>,
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
      // Keep any estimate returned with the recommendation until canonical
      // materialization succeeds. A selected provider candidate is not yet a
      // trusted disposition, so this is the safe fallback for medium/ambiguous
      // recommendations and failed high-confidence materialization.
      if (decision.nutritionEstimate !== undefined) {
        pendingEstimates.set(row.id, decision.nutritionEstimate);
      }
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

      const resolvedPortion = resolvePhotoPortionForCandidate(
        row.provisionalPortion,
        candidate,
      );
      const portionResolution = resolvedPortion.servingResolution;
      const selectedCandidateId = parseCandidateId(candidate);
      const loggable =
        portionResolution === 'supported' &&
        !resolvedPortion.userReviewRequired;
      return {
        ...row,
        provisionalPortion: resolvedPortion.portion,
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
      if (decision.nutritionEstimate !== undefined) {
        pendingEstimates.set(row.id, decision.nutritionEstimate);
      }
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

    if (decision.nutritionEstimate !== undefined) {
      pendingEstimates.set(row.id, decision.nutritionEstimate);
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

function estimateMetadata(
  row: PhotoRecognizedItem,
  values: PhotoNutritionEstimateValues | undefined,
): Pick<PhotoRecognizedItem, 'estimatedNutrition'> {
  if (values === undefined) return {};
  const quantity = row.provisionalPortion?.quantity;
  const basis =
    quantity?.state === 'estimated'
      ? ('structured_quantity' as const)
      : ('portion_shown' as const);
  const label = quantity?.state === 'estimated' ? quantity.rawText : null;
  return {
    estimatedNutrition: buildPhotoNutritionEstimate(values, basis, label),
  };
}

function attachEstimateProofs(input: {
  rows: PhotoRecognizedItem[];
  userId: string;
  config: PhotoAnalysisConfig;
}): PhotoRecognizedItem[] {
  if (!input.config.photoEstimateConfirmationEnabled) return input.rows;
  return input.rows.map((row) => {
    const estimate = row.estimatedNutrition;
    const quantity = row.provisionalPortion?.quantity;
    if (estimate === undefined || quantity === undefined) return row;
    return {
      ...row,
      estimatedNutrition: {
        ...estimate,
        estimateProof: issuePhotoEstimateProof({
          secret: input.config.photoEstimateProofSecret,
          userId: input.userId,
          rowRef: row.id,
          recognizedName: row.recognizedName,
          preparationForm: row.preparationForm,
          representationKind: row.representationKind,
          estimateBasis: estimate.basis,
          quantity,
          estimate: {
            calories: estimate.calories,
            proteinGrams: estimate.proteinGrams,
            carbohydrateGrams: estimate.carbohydrateGrams,
            fatGrams: estimate.fatGrams,
            confidence: estimate.confidence,
          },
          ttlSeconds: input.config.photoEstimateProofTtlSeconds,
        }),
      },
    };
  });
}

async function adjudicateRows(input: {
  rows: PhotoRecognizedItem[];
  config: PhotoAnalysisConfig;
  signal: AbortSignal;
}): Promise<{
  rows: PhotoRecognizedItem[];
  pendingEstimates: Map<string, PhotoNutritionEstimateValues>;
}> {
  const pendingEstimates = new Map<string, PhotoNutritionEstimateValues>();
  if (
    !input.config.candidateAdjudicationEnabled &&
    !input.config.nutritionEstimationEnabled
  ) {
    return { rows: input.rows, pendingEstimates };
  }
  const prepared = prepareAdjudication(input.rows, input.config);
  if (prepared.request.rows.length === 0) {
    return { rows: input.rows, pendingEstimates };
  }

  const provider = photoCandidateAdjudicationProvider({
    provider: input.config.provider,
    geminiApiKey: input.config.geminiApiKey,
    geminiModel: input.config.geminiModel,
    timeoutMs: input.config.candidateAdjudicationTimeoutMs,
    maxCandidates: input.config.candidateAdjudicationMaxCandidates,
    maxRows: input.config.candidateAdjudicationMaxRows,
    maxOutputTokens: input.config.candidateAdjudicationMaxOutputTokens,
    mockDecision: input.config.candidateAdjudicationMockDecision,
    nutritionEstimationEnabled: input.config.nutritionEstimationEnabled,
    nutritionEstimationMock: input.config.nutritionEstimationMock,
  });
  const result = await provider.adjudicate({
    request: prepared.request,
    signal: input.signal,
  });
  return {
    rows: applyAdjudication(input.rows, prepared, result, pendingEstimates),
    pendingEstimates,
  };
}

export function applyPendingEstimates(input: {
  rows: PhotoRecognizedItem[];
  pendingEstimates: Map<string, PhotoNutritionEstimateValues>;
}): PhotoRecognizedItem[] {
  return input.rows.map((row) => {
    // A selected external candidate is only a recommendation until the
    // provider-neutral materializer returns a canonical FoodItem. Keep the
    // bounded estimate alongside that recommendation so failed or unsafe
    // materialization can still produce the effective estimated disposition.
    const canonicalIdentity = row.candidates.some(
      (candidate) =>
        candidate.candidateType === 'food_item' &&
        row.selectedCandidateId !== null &&
        parseCandidateId(candidate) === row.selectedCandidateId,
    );
    if (row.loggable || canonicalIdentity) {
      if (!canonicalIdentity || row.estimatedNutrition === undefined)
        return row;
      const next = { ...row };
      delete next.estimatedNutrition;
      return next;
    }
    const values = input.pendingEstimates.get(row.id);
    return values === undefined
      ? row
      : { ...row, ...estimateMetadata(row, values) };
  });
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

  const adjudication = await adjudicateRows({
    rows: initialItems,
    config: input.config,
    signal: input.signal,
  });
  const automaticallyResolvedItems = await resolveAutomaticExternalCandidates({
    rows: adjudication.rows,
    materialize: (candidate) =>
      withExternalFoodMaterializationLock({
        sourceProvider: candidate.externalFood.sourceProvider,
        sourceId: candidate.externalFood.sourceId,
        operation: async () => {
          const persisted = await prisma.$transaction((transaction) =>
            findOrCreateExternalFoodItem({
              sourceProvider: candidate.externalFood.sourceProvider,
              sourceId: candidate.externalFood.sourceId,
              servingOptions: candidate.externalFood.servingOptions,
              config: usdaFdcConfig(),
              transaction,
            }),
          );
          return serializeFoodItem(persisted);
        },
      }),
  });
  const estimatedItems = applyPendingEstimates({
    rows: automaticallyResolvedItems,
    pendingEstimates: adjudication.pendingEstimates,
  });
  const items = attachEstimateProofs({
    rows: estimatedItems,
    userId: input.userId,
    config: input.config,
  });

  const result: PhotoAnalysisResult = {
    status: 'recognized',
    items,
    representationGroups: representations.groups,
  };
  photoAnalysisResultSchema.parse(result);
  return result;
}
