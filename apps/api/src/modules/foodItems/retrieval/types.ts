import type {
  AiFoodParseCandidate,
  FoodSourceProvider,
} from '@food-tracker/shared';
import type { CandidateSource } from '../candidate-ranking.js';

export type RetrievalMode = 'normal_search' | 'ai' | 'photo';

export interface CandidateIdentityTerms {
  /** Canonical name is always derived from candidate.foodItem.name. */
  authoritativeAliases: readonly string[];
}

export interface RetrievalEvidence {
  lexical: boolean;
  fuzzyDistance: number | null;
  semanticScore: number | null;
}

export interface GeneratedCandidate {
  candidate: AiFoodParseCandidate;
  identity: CandidateIdentityTerms;
  provenance: {
    rankingSource: CandidateSource;
    sourceProvider: FoodSourceProvider | null;
    sourceRegion: string | null;
  };
  evidence: RetrievalEvidence;
}

export interface RetrievalPolicyInput {
  mode: RetrievalMode;
  trustedLocalCandidate: boolean;
  usefulTopKCount: number;
  requestedLimit: number;
}

export interface RetrievalPolicyDecision {
  fetchFuzzy: boolean;
  fetchSemantic: boolean;
  fetchUsda: boolean;
}

export function decideRetrievalPolicy(
  input: RetrievalPolicyInput,
): RetrievalPolicyDecision {
  const normalNeedsCoverage =
    input.usefulTopKCount < Math.max(1, Math.min(input.requestedLimit, 3));
  if (input.mode === 'normal_search') {
    return {
      fetchFuzzy: normalNeedsCoverage,
      fetchSemantic: normalNeedsCoverage,
      fetchUsda: normalNeedsCoverage,
    };
  }
  if (input.trustedLocalCandidate)
    return { fetchFuzzy: false, fetchSemantic: false, fetchUsda: false };
  return { fetchFuzzy: true, fetchSemantic: true, fetchUsda: true };
}

export function unionGeneratedCandidates(
  groups: readonly (readonly GeneratedCandidate[])[],
): GeneratedCandidate[] {
  const result: GeneratedCandidate[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const candidate of group) {
      const foodId =
        candidate.candidate.candidateType === 'food_item'
          ? candidate.candidate.foodItem.id
          : `${candidate.candidate.externalFood.sourceProvider}:${candidate.candidate.externalFood.sourceId}`;
      if (seen.has(foodId)) continue;
      seen.add(foodId);
      result.push(candidate);
    }
  }
  return result;
}
