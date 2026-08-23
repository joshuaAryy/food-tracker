import type {
  AiFoodCandidateMatchReason,
  AiFoodParseCandidate,
  FoodItem,
  FoodSourceProvider,
} from '@food-tracker/shared';
import { defaultWholeItemServingFromOptions } from '../usda-fdc.js';

export interface CandidateRetrievalEvidence {
  lexical: boolean;
  fuzzyDistance: number | null;
  semanticScore: number | null;
}

export function candidateMatchReason(input: {
  sourceType: FoodItem['sourceType'] | string;
  sourceProvider: FoodSourceProvider | string | null;
  hasBarcode: boolean;
  isSaved?: boolean;
  isRecent?: boolean;
}): AiFoodCandidateMatchReason {
  if (input.isRecent === true) return 'recent';
  if (input.isSaved === true) return 'saved';
  if (input.sourceType === 'user_custom') return 'custom';
  if (
    input.sourceProvider === 'cnf' ||
    input.sourceProvider === 'ciqual' ||
    input.sourceProvider === 'cofid' ||
    input.sourceProvider === 'usda_fdc'
  ) {
    return 'reference';
  }
  if (input.sourceType === 'app_owned') return 'app';
  return input.hasBarcode ? 'barcode_cached' : 'cached_external';
}

export function foodItemCandidate(input: {
  foodItem: FoodItem;
  matchReason: AiFoodCandidateMatchReason;
  rank: number;
  retrievalEvidence?: CandidateRetrievalEvidence;
}): AiFoodParseCandidate {
  return {
    candidateType: 'food_item',
    foodItem: {
      ...input.foodItem,
      defaultWholeItemServing:
        input.foodItem.defaultWholeItemServing ??
        defaultWholeItemServingFromOptions(input.foodItem.servingOptions),
    },
    externalFood: null,
    rank: input.rank,
    matchReason: input.matchReason,
    confidence: 'low',
    defaultServingMultiplier: 1,
    ...(input.retrievalEvidence === undefined
      ? {}
      : { retrievalEvidence: input.retrievalEvidence }),
  };
}

export function candidateIdentityKey(candidate: AiFoodParseCandidate): string {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem.id
    : `${candidate.externalFood.sourceProvider}:${candidate.externalFood.sourceId}`;
}

export function appendUniqueCandidate(input: {
  candidates: AiFoodParseCandidate[];
  seen: Set<string>;
  candidate: AiFoodParseCandidate;
}): boolean {
  const key = candidateIdentityKey(input.candidate);
  if (input.seen.has(key)) return false;
  input.seen.add(key);
  if (
    input.candidate.candidateType === 'food_item' &&
    input.candidate.foodItem.sourceProvider !== null &&
    input.candidate.foodItem.sourceId !== null
  ) {
    input.seen.add(
      `${input.candidate.foodItem.sourceProvider}:${input.candidate.foodItem.sourceId}`,
    );
  }
  input.candidates.push({
    ...input.candidate,
    rank: input.candidates.length + 1,
  });
  return true;
}
