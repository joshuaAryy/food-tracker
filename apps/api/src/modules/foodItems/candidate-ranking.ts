import type {
  AiFoodCandidateConfidence,
  AiFoodParseCandidate,
} from '@food-tracker/shared';
import { assessFoodIntent } from './food-intent.js';
import { normalizeFoodIdentityText } from './text-normalization.js';

export type CandidateSource =
  | 'recent'
  | 'saved'
  | 'custom'
  | 'app'
  | 'app_curated'
  | 'reference'
  | 'cached_external'
  | 'barcode_cached'
  | 'usda_fdc';

export interface RankableFoodCandidate {
  name: string;
  /** Provider-authoritative identity equivalents; never full searchText. */
  authoritativeAliases?: readonly string[];
  sourceRegion?: string | null;
  sourceProvider?: string | null;
  retrievalEvidence?: {
    lexical: boolean;
    fuzzyDistance: number | null;
    fuzzyKind?: 'whole_string' | 'strict_word';
    semanticScore: number | null;
  };
  brandName: string | null;
  foodType: 'generic' | 'branded';
  source: CandidateSource;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  nutrientCount: number;
  servingQuantity: number | null;
  servingUnit: string | null;
  servingWeightGrams: number | null;
}

export interface CandidateScore {
  score: number;
  confidenceScore: number;
  relevant: boolean;
  visibleRelevant: boolean;
  selectionEligible: boolean;
  loggable: boolean;
  penalties: string[];
  allCoreTokensMatch: boolean;
  strongIdentityMatch: boolean;
  allRequestedDescriptorsMatch: boolean;
  defaultSuitable: boolean;
}

export interface CandidateAdequacy {
  hasAdequateCandidate: boolean;
  topCandidateAdequate: boolean;
  mostlyInadequate: boolean;
  adequateCandidateCount: number;
}

const GENERIC_FOOD_WORDS = new Set([
  'bowl',
  'plate',
  'serving',
  'homemade',
  'custom',
  'meal',
  'food',
  'dish',
  'portion',
  'with',
  'and',
]);

const PREPARATION_WORDS = new Set([
  'boiled',
  'scrambled',
  'cooked',
  'grilled',
  'baked',
  'roasted',
  'broiled',
  'steamed',
  'raw',
  'plain',
  'lowfat',
  'reduced',
  'sodium',
  'meat',
  'toasted',
]);

// Adjectives and nutrient attributes qualify a food identity; they should not
// become the identity that determines whether a candidate is relevant.
const ATTRIBUTE_WORDS = new Set([
  'high',
  'low',
  'fiber',
  'fibre',
  'protein',
  'calorie',
  'calories',
  'healthy',
  'organic',
  'natural',
  'light',
]);

const STRONG_NEGATIVE_TERMS = [
  ['fast', 'food'],
  ['commercial', 'mix'],
  ['prepared', 'meal'],
  ['babyfood'],
  ['dehydrated'],
  ['dried'],
  ['powder'],
  ['powdered'],
  ['flour'],
  ['baby'],
  ['infant'],
  ['toddler'],
  ['restaurant'],
  ['school'],
] as const;

const FORM_PENALTY_TERMS = [
  ['snack'],
  ['cake'],
  ['cookie'],
  ['sandwich'],
  ['cereal'],
  ['flour'],
  ['cracker'],
  ['candy'],
  ['chocolate'],
  ['breaded'],
  ['deli'],
  ['lunchmeat'],
  ['prepackaged'],
  ['honey', 'glazed'],
  ['blueberry'],
  ['strawberry'],
  ['vanilla'],
  ['chip'],
  ['melon'],
  ['pepper'],
  ['roll'],
  ['egg', 'white'],
  ['frozen'],
  ['pasteurized'],
  ['leave'],
] as const;

const NEGATIVE_DESCRIPTOR_TERMS = [
  ...STRONG_NEGATIVE_TERMS,
  ...FORM_PENALTY_TERMS,
] as const;

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

export function normalizeText(value: string): string {
  return normalizeFoodIdentityText(value);
}

export function normalizeToken(value: string): string {
  const normalized = normalizeText(value).replace(/[^a-z0-9]/g, '');
  if (normalized === 'toasted') return 'toast';
  if (normalized === 'oatmeal') return 'oat';
  if (normalized === 'cookies') return 'cookie';
  if (normalized.length > 3 && normalized.endsWith('ies')) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (normalized.length > 4 && normalized.endsWith('oes')) {
    return normalized.slice(0, -2);
  }
  if (normalized.length > 2 && normalized.endsWith('s')) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

export function meaningfulTokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .map(normalizeToken)
      .filter((token) => token.length >= 2 && !GENERIC_FOOD_WORDS.has(token)),
  );
}

export function queryVariants(value: string): string[] {
  const normalized = normalizeText(value);
  const tokenNormalized = normalized.split(/\s+/).map(normalizeToken).join(' ');
  return uniqueValues([normalized, tokenNormalized]).filter(
    (variant) => variant.length > 0,
  );
}

export function externalSearchQuery(value: string): string {
  return queryVariants(value).at(-1) ?? value;
}

export function hasMeaningfulOverlap(left: string, right: string): boolean {
  const leftTokens = meaningfulTokens(left);
  if (leftTokens.size === 0) return false;
  const rightTokens = meaningfulTokens(right);

  for (const token of leftTokens) {
    if (rightTokens.has(token)) return true;
  }

  return false;
}

function descriptorTokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .map(normalizeToken)
      .filter((token) => token.length > 0),
  );
}

interface QueryTokenGroups {
  coreFoodTokens: string[];
  modifierTokens: string[];
  negativeDescriptorTokens: string[];
  genericStopwords: string[];
}

export function classifyQueryTokens(value: string): QueryTokenGroups {
  const tokens = normalizeText(value).split(/\s+/).map(normalizeToken);
  const genericStopwords: string[] = [];
  const modifierTokens: string[] = [];
  const negativeDescriptorTokens: string[] = [];
  const coreFoodTokens: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    const nextToken = tokens[index + 1];
    if (
      (token === 'no' || token === 'without') &&
      nextToken !== undefined &&
      nextToken.length >= 2
    ) {
      genericStopwords.push(token);
      negativeDescriptorTokens.push(nextToken);
      index += 1;
      continue;
    }
    if (token === 'skinless') {
      negativeDescriptorTokens.push('skin');
      continue;
    }
    if (token.length < 2 || GENERIC_FOOD_WORDS.has(token)) {
      genericStopwords.push(token);
    } else if (PREPARATION_WORDS.has(token) || ATTRIBUTE_WORDS.has(token)) {
      modifierTokens.push(token);
    } else {
      coreFoodTokens.push(token);
    }
  }

  return {
    coreFoodTokens: uniqueValues(coreFoodTokens),
    modifierTokens: uniqueValues(modifierTokens),
    negativeDescriptorTokens: uniqueValues(negativeDescriptorTokens),
    genericStopwords: uniqueValues(genericStopwords),
  };
}

function containsAllTokens(
  candidateTokens: Set<string>,
  queryTokens: string[],
) {
  return (
    queryTokens.length > 0 &&
    queryTokens.every((token) => candidateTokens.has(token))
  );
}

function phraseMatch(query: string, name: string): boolean {
  const nameVariants = queryVariants(name);
  return queryVariants(query).some((queryVariant) =>
    nameVariants.includes(queryVariant),
  );
}

function firstFoodToken(tokens: Set<string>): string | undefined {
  return [...tokens][0];
}

function editDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current.push(
        left[leftIndex] === right[rightIndex]
          ? previous[rightIndex]!
          : 1 +
              Math.min(
                previous[rightIndex]!,
                previous[rightIndex + 1]!,
                current[rightIndex]!,
              ),
      );
    }
    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index]!;
    }
  }
  return previous[right.length]!;
}

function fuzzyTokenDistanceLimit(queryToken: string): number {
  // Longer misspellings need a little tolerance, but two edits are too
  // permissive for short identity words (`bean` and `bar`, for example).
  return queryToken.length >= 5 ? 2 : 1;
}

function isBrandedQuery(
  query: string,
  candidate: RankableFoodCandidate,
): boolean {
  if (candidate.brandName === null) return false;
  const queryTokens = meaningfulTokens(query);
  const brandTokens = meaningfulTokens(candidate.brandName);

  for (const token of brandTokens) {
    if (queryTokens.has(token)) return true;
  }

  return false;
}

function termRequested(
  term: readonly string[],
  queryTokens: Set<string>,
): boolean {
  return term.every((token) => queryTokens.has(normalizeToken(token)));
}

function termPresent(
  term: readonly string[],
  candidateTokens: Set<string>,
): boolean {
  return term.every((token) => candidateTokens.has(normalizeToken(token)));
}

function negativeDescriptorPenalty(input: {
  queryTokens: Set<string>;
  candidateTokens: Set<string>;
  explicitNegativeTokens?: readonly string[];
  candidateText?: string;
}): boolean {
  const normalizedCandidateText = normalizeText(input.candidateText ?? '');
  const explicitContradiction = (input.explicitNegativeTokens ?? []).some(
    (token) => {
      if (!input.candidateTokens.has(token)) return false;
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const negated = new RegExp(
        `(?:no|without)\\s+${escaped}\\b|${escaped}less\\b`,
      );
      return !negated.test(normalizedCandidateText);
    },
  );
  if (explicitContradiction) return true;

  const requestedProductForm = FORM_PENALTY_TERMS.some(
    (term) =>
      termRequested(term, input.queryTokens) &&
      termPresent(term, input.candidateTokens),
  );

  return NEGATIVE_DESCRIPTOR_TERMS.some((term) => {
    if (!termPresent(term, input.candidateTokens)) return false;
    if (termRequested(term, input.queryTokens)) return false;
    return !(term[0] === 'snack' && requestedProductForm);
  });
}

function sourceBonus(source: CandidateSource): number {
  switch (source) {
    case 'recent':
      return 32;
    case 'saved':
      return 28;
    case 'custom':
      return 24;
    case 'app':
      return 18;
    case 'app_curated':
      return 18;
    case 'reference':
      return 18;
    case 'usda_fdc':
      // Preserve legacy inputs while keeping generic USDA reference quality
      // comparable with imported national composition references.
      return 18;
    case 'barcode_cached':
      return 8;
    case 'cached_external':
      return 4;
  }
}

function nutritionBonus(candidate: RankableFoodCandidate): number {
  let score = 0;
  if (candidate.calories !== null) score += 5;
  if (candidate.protein !== null) score += 5;
  if (candidate.carbs !== null) score += 2;
  if (candidate.fat !== null) score += 2;
  if (candidate.fiber !== null) score += 1;
  if (candidate.sugar !== null) score += 1;
  if (candidate.sodium !== null) score += 1;
  return score + Math.min(candidate.nutrientCount, 8);
}

function servingBonus(candidate: RankableFoodCandidate): number {
  let score = 0;
  if (candidate.servingQuantity !== null) score += 2;
  if (candidate.servingUnit !== null) score += 2;
  if (candidate.servingWeightGrams !== null) score += 3;
  return score;
}

export function scoreFoodCandidate(input: {
  query: string;
  candidate: RankableFoodCandidate;
}): CandidateScore {
  const normalizedQuery = normalizeText(input.query);
  const normalizedName = normalizeText(input.candidate.name);
  const queryGroups = classifyQueryTokens(normalizedQuery);
  const requestedDescriptorTokens = [...queryGroups.modifierTokens];
  const queryDescriptorTokens = descriptorTokens(normalizedQuery);
  const candidateDescriptorTokens = descriptorTokens(
    input.candidate.brandName === null
      ? input.candidate.name
      : `${input.candidate.name} ${input.candidate.brandName}`,
  );
  const nameTokens = meaningfulTokens(input.candidate.name);
  const authoritativeAliases = (input.candidate.authoritativeAliases ?? [])
    .map(normalizeText)
    .filter((alias) => alias.length > 0);
  const aliasIdentityMatch = authoritativeAliases.some((alias) => {
    const aliasTokens = meaningfulTokens(alias);
    return (
      alias === normalizedQuery ||
      containsAllTokens(aliasTokens, queryGroups.coreFoodTokens)
    );
  });
  const nameDescriptorTokens = descriptorTokens(input.candidate.name);
  const candidateBrandTokens =
    input.candidate.brandName === null
      ? new Set<string>()
      : meaningfulTokens(input.candidate.brandName);
  const queryCoreTokens = queryGroups.coreFoodTokens.filter(
    (token) => !candidateBrandTokens.has(token),
  );
  const foodIntent = assessFoodIntent({
    query: normalizedQuery,
    candidateName: input.candidate.name,
  });
  const exact = normalizedName === normalizedQuery;
  const singularPlural = phraseMatch(normalizedQuery, input.candidate.name);
  const coreTokenMatches = queryCoreTokens.filter((token) =>
    nameTokens.has(token),
  );
  const fuzzyDistance = input.candidate.retrievalEvidence?.fuzzyDistance;
  const fuzzyKind = input.candidate.retrievalEvidence?.fuzzyKind;
  const fuzzyCoreCoverage =
    queryCoreTokens.length > 0 &&
    coreTokenMatches.length >=
      Math.max(1, Math.ceil(queryCoreTokens.length / 2));
  const fuzzyEvidence =
    fuzzyDistance !== null &&
    fuzzyDistance !== undefined &&
    (fuzzyKind === 'whole_string'
      ? queryCoreTokens.length === 1
      : fuzzyKind === 'strict_word'
        ? queryCoreTokens.length === 1 || fuzzyCoreCoverage
        : queryCoreTokens.length === 1 || fuzzyCoreCoverage);
  const semanticEvidence =
    input.candidate.retrievalEvidence?.semanticScore !== null &&
    input.candidate.retrievalEvidence?.semanticScore !== undefined;
  const fuzzyIdentityMatch =
    fuzzyEvidence &&
    queryCoreTokens.length === 1 &&
    [...nameTokens].some(
      (token) =>
        token.length >= 3 &&
        editDistance(token, queryCoreTokens[0]!) <=
          fuzzyTokenDistanceLimit(queryCoreTokens[0]!),
    );
  const fuzzyIdentityMatchCount = fuzzyEvidence
    ? queryCoreTokens.filter((queryToken) =>
        [...nameTokens].some(
          (token) =>
            token.length >= 3 &&
            editDistance(token, queryToken) <=
              fuzzyTokenDistanceLimit(queryToken),
        ),
      ).length
    : 0;
  const fuzzyMatchedCandidateTokens = fuzzyEvidence
    ? [...nameTokens].filter((token) =>
        queryCoreTokens.some(
          (queryToken) =>
            token.length >= 3 &&
            editDistance(token, queryToken) <=
              fuzzyTokenDistanceLimit(queryToken),
        ),
      )
    : [];
  const hasCoreTokenMatch =
    coreTokenMatches.length > 0 ||
    aliasIdentityMatch ||
    foodIntent.identityAliasMatch ||
    fuzzyIdentityMatch;
  const allCoreTokensMatch =
    containsAllTokens(nameTokens, queryCoreTokens) ||
    aliasIdentityMatch ||
    foodIntent.identityAliasMatch;
  const strongHeadMatch =
    queryCoreTokens[0] !== undefined &&
    firstFoodToken(nameTokens) === queryCoreTokens[0];
  const strongIdentityMatch =
    exact ||
    singularPlural ||
    strongHeadMatch ||
    aliasIdentityMatch ||
    foodIntent.identityHeadMatch;
  const candidateHead = firstFoodToken(nameTokens);
  const queryHead = queryCoreTokens[0];
  const fuzzyHeadMatch =
    fuzzyEvidence &&
    queryHead !== undefined &&
    candidateHead !== undefined &&
    candidateHead.length >= 3 &&
    editDistance(candidateHead, queryHead) <=
      fuzzyTokenDistanceLimit(queryHead);
  const identityMatchedTokens = queryCoreTokens.filter(
    (queryToken) =>
      nameTokens.has(queryToken) ||
      (fuzzyEvidence &&
        [...nameTokens].some(
          (candidateToken) =>
            candidateToken.length >= 3 &&
            editDistance(candidateToken, queryToken) <=
              fuzzyTokenDistanceLimit(queryToken),
        )),
  );
  const identityCoverageCount =
    aliasIdentityMatch || foodIntent.identityAliasMatch
      ? queryCoreTokens.length
      : identityMatchedTokens.length;
  const insufficientCoreCoverage =
    queryCoreTokens.length > 1 &&
    identityCoverageCount < queryCoreTokens.length;
  const incidentalIdentityMatch =
    queryCoreTokens.length > 1 &&
    identityCoverageCount === 1 &&
    (!strongHeadMatch || insufficientCoreCoverage) &&
    !fuzzyHeadMatch &&
    !foodIntent.identityHeadMatch &&
    !aliasIdentityMatch;
  const requestedDescriptorMatches = requestedDescriptorTokens.filter((token) =>
    nameDescriptorTokens.has(token),
  ).length;
  const allRequestedDescriptorsMatch =
    requestedDescriptorTokens.length === 0 ||
    requestedDescriptorMatches === requestedDescriptorTokens.length;
  const hasUnrequestedNegative = negativeDescriptorPenalty({
    queryTokens: new Set([
      ...queryDescriptorTokens,
      ...fuzzyMatchedCandidateTokens,
    ]),
    candidateTokens: candidateDescriptorTokens,
    explicitNegativeTokens: queryGroups.negativeDescriptorTokens,
    candidateText:
      input.candidate.brandName === null
        ? input.candidate.name
        : `${input.candidate.name} ${input.candidate.brandName}`,
  });
  const explicitNegativeContradiction =
    hasUnrequestedNegative && queryGroups.negativeDescriptorTokens.length > 0;
  const positiveSkinRequested = /\bwith\s+skin\b/.test(normalizedQuery);
  const candidateWithoutSkin = /\bwithout\s+skin\b|\bskinless\b/.test(
    normalizedName,
  );
  const positiveDescriptorMismatch =
    positiveSkinRequested && candidateWithoutSkin;
  const brandedMismatch =
    input.candidate.foodType === 'branded' &&
    input.candidate.brandName !== null &&
    !isBrandedQuery(normalizedQuery, input.candidate);
  const brandRequested =
    input.candidate.foodType === 'branded' &&
    isBrandedQuery(normalizedQuery, input.candidate);
  const loggable =
    input.candidate.calories !== null && input.candidate.protein !== null;
  const penalties: string[] = [];
  let score = sourceBonus(input.candidate.source);
  let confidenceScore = 0;

  if (
    input.candidate.retrievalEvidence?.semanticScore !== null &&
    input.candidate.retrievalEvidence?.semanticScore !== undefined
  ) {
    score += Math.max(
      0,
      Math.min(12, input.candidate.retrievalEvidence.semanticScore * 12),
    );
  }

  if (hasCoreTokenMatch && exact) {
    score += 130;
    confidenceScore += 3;
  } else if (hasCoreTokenMatch && singularPlural) {
    score += 115;
    confidenceScore += 3;
  }
  if (allCoreTokensMatch) {
    score += 85;
    confidenceScore += 2;
  } else if (hasCoreTokenMatch) {
    score += 42;
    confidenceScore += 1;
  }

  if (hasCoreTokenMatch && strongHeadMatch && !exact && !singularPlural) {
    score += 30;
    confidenceScore += 1;
  }

  if (hasCoreTokenMatch) {
    score += requestedDescriptorMatches * 18;
    score -=
      (requestedDescriptorTokens.length - requestedDescriptorMatches) * 12;
    if (allRequestedDescriptorsMatch) confidenceScore += 1;
  }
  score += nutritionBonus(input.candidate);
  score += servingBonus(input.candidate);

  if (fuzzyIdentityMatchCount > 0) {
    score += Math.min(70, fuzzyIdentityMatchCount * 35);
    if (queryCoreTokens.length === 1) {
      score -= Math.max(0, nameTokens.size - 1) * 4;
    }
    confidenceScore += 1;
  }

  if (brandRequested) {
    score += 60;
    confidenceScore += 1;
  }

  if (brandedMismatch) {
    penalties.push('branded_mismatch');
    score -= 90;
    confidenceScore -= 3;
  }

  if (hasUnrequestedNegative) {
    penalties.push('negative_descriptor');
    score -= 140;
    confidenceScore -= 3;
  }

  if (positiveDescriptorMismatch) {
    penalties.push('positive_descriptor_mismatch');
    score -= 90;
    confidenceScore -= 2;
  }

  if (insufficientCoreCoverage) {
    penalties.push('insufficient_core_coverage');
    score -= (queryCoreTokens.length - identityCoverageCount) * 42;
    confidenceScore -= 2;
  }

  if (foodIntent.conflictsDefault) {
    penalties.push('edible_default_conflict');
  }
  if (hasCoreTokenMatch) {
    score += foodIntent.scoreAdjustment;
  }

  if (!loggable) {
    score -= 35;
  }

  const visibleRelevant =
    !incidentalIdentityMatch &&
    !explicitNegativeContradiction &&
    (hasCoreTokenMatch || fuzzyIdentityMatch || semanticEvidence) &&
    (foodIntent.category === null ||
      foodIntent.identityHeadMatch ||
      aliasIdentityMatch);
  const defaultSuitable =
    !brandedMismatch &&
    !hasUnrequestedNegative &&
    !positiveDescriptorMismatch &&
    allCoreTokensMatch &&
    allRequestedDescriptorsMatch &&
    foodIntent.defaultSuitable;
  const selectionEligible =
    loggable &&
    visibleRelevant &&
    !brandedMismatch &&
    !hasUnrequestedNegative &&
    !positiveDescriptorMismatch &&
    allCoreTokensMatch &&
    allRequestedDescriptorsMatch &&
    foodIntent.selectionEligible &&
    (input.candidate.retrievalEvidence === undefined ||
      input.candidate.retrievalEvidence.lexical === true ||
      aliasIdentityMatch ||
      foodIntent.identityAliasMatch);

  return {
    score,
    confidenceScore,
    relevant: visibleRelevant,
    visibleRelevant,
    selectionEligible,
    loggable,
    penalties,
    allCoreTokensMatch,
    strongIdentityMatch,
    allRequestedDescriptorsMatch,
    defaultSuitable,
  };
}

export function confidenceForScore(
  score: CandidateScore,
): AiFoodCandidateConfidence {
  if (
    score.penalties.includes('branded_mismatch') ||
    score.penalties.includes('negative_descriptor') ||
    score.penalties.includes('edible_default_conflict') ||
    score.penalties.includes('insufficient_core_coverage')
  ) {
    return 'low';
  }
  if (
    score.loggable &&
    score.relevant &&
    score.allCoreTokensMatch &&
    score.strongIdentityMatch &&
    score.allRequestedDescriptorsMatch &&
    score.defaultSuitable &&
    score.selectionEligible &&
    score.confidenceScore >= 3
  ) {
    return 'high';
  }
  if (score.relevant && score.confidenceScore >= 1) return 'medium';
  return 'low';
}

/** Evaluates whether ranked names contain an edible default for the original query. */
export function assessFoodCandidateAdequacy(input: {
  query: string;
  candidateNames: string[];
}): CandidateAdequacy {
  const scores = input.candidateNames.map((name) =>
    scoreFoodCandidate({
      query: input.query,
      candidate: {
        name,
        brandName: null,
        foodType: 'generic',
        source: 'usda_fdc',
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrientCount: 0,
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: 100,
      },
    }),
  );
  const adequate = scores.filter(
    (score) =>
      score.visibleRelevant &&
      score.defaultSuitable &&
      score.strongIdentityMatch &&
      score.allRequestedDescriptorsMatch,
  );

  return {
    hasAdequateCandidate: adequate.length > 0,
    topCandidateAdequate:
      scores[0] !== undefined && adequate.some((score) => score === scores[0]),
    mostlyInadequate: scores.length > 0 && adequate.length * 2 < scores.length,
    adequateCandidateCount: adequate.length,
  };
}

function candidateFood(candidate: AiFoodParseCandidate) {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem
    : candidate.externalFood;
}

export function rankableFromParseCandidate(
  candidate: AiFoodParseCandidate,
): RankableFoodCandidate {
  const food = candidateFood(candidate);
  const matchReason = candidate.matchReason;
  const prioritySource =
    matchReason === 'recent' ||
    matchReason === 'saved' ||
    matchReason === 'custom' ||
    matchReason === 'barcode_cached'
      ? matchReason
      : undefined;
  return {
    name: food.name,
    authoritativeAliases:
      'authoritativeAliases' in food && Array.isArray(food.authoritativeAliases)
        ? food.authoritativeAliases
        : [],
    sourceRegion: 'sourceRegion' in food ? (food.sourceRegion ?? null) : null,
    sourceProvider:
      'sourceProvider' in food ? (food.sourceProvider ?? null) : null,
    ...(candidate.retrievalEvidence === undefined
      ? {}
      : { retrievalEvidence: candidate.retrievalEvidence }),
    brandName: food.brandName,
    foodType: food.foodType,
    source:
      prioritySource ??
      (candidate.candidateType === 'food_item'
        ? (candidate.foodItem.rankingSource ??
          (matchReason === 'usda_fdc' ? 'reference' : matchReason))
        : matchReason === 'usda_fdc'
          ? 'reference'
          : matchReason),
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    sugar: food.sugar,
    sodium: food.sodium,
    nutrientCount: Object.keys(food.nutrients).length,
    servingQuantity: food.servingQuantity,
    servingUnit: food.servingUnit,
    servingWeightGrams: food.servingWeightGrams,
  };
}

function localeRelevance(
  candidate: RankableFoodCandidate,
  explicitRegion?: string | null,
): number {
  const explicit = explicitRegion?.trim().toUpperCase();
  const configured =
    process.env.FOOD_SEARCH_DEFAULT_REGION?.trim().toUpperCase();
  const region =
    (explicit !== undefined && /^[A-Z]{2}$/.test(explicit)
      ? explicit
      : undefined) ??
    (configured !== undefined && /^[A-Z]{2}$/.test(configured)
      ? configured
      : undefined);
  if (region === undefined || region.length === 0) return 0;
  if (
    candidate.source === 'reference' &&
    candidate.sourceRegion?.toUpperCase() === region
  )
    return 1;
  return 0;
}

export function parseCandidateId(candidate: AiFoodParseCandidate): string {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem.id
    : `${candidate.externalFood.sourceProvider}:${candidate.externalFood.sourceId}`;
}

export function rankParseCandidates(
  query: string,
  candidates: AiFoodParseCandidate[],
  options: { region?: string | null } = {},
): AiFoodParseCandidate[] {
  return candidates
    .map((candidate, index) => {
      const score = scoreFoodCandidate({
        query,
        candidate: rankableFromParseCandidate(candidate),
      });
      return {
        candidate: {
          ...candidate,
          confidence: confidenceForScore(score),
        },
        score,
        index,
        localeScore: localeRelevance(
          rankableFromParseCandidate(candidate),
          options.region,
        ),
      };
    })
    .filter(({ score }) => score.relevant)
    .sort((left, right) => {
      if (right.score.score !== left.score.score) {
        return right.score.score - left.score.score;
      }
      if (right.localeScore !== left.localeScore) {
        return right.localeScore - left.localeScore;
      }
      return left.index - right.index;
    })
    .map(({ candidate }, index) => ({
      ...candidate,
      rank: index + 1,
    }));
}

export function bestTrustedCandidate(
  query: string,
  candidates: AiFoodParseCandidate[],
): AiFoodParseCandidate | undefined {
  return rankParseCandidates(query, candidates).find((candidate) => {
    const score = scoreFoodCandidate({
      query,
      candidate: rankableFromParseCandidate(candidate),
    });
    const confidence = confidenceForScore(score);
    return score.loggable && score.selectionEligible && confidence !== 'low';
  });
}

export function hasRelevantTrustedCandidate(input: {
  parsedName: string;
  candidate: AiFoodParseCandidate | undefined;
}): boolean {
  if (input.candidate === undefined) return false;
  const score = scoreFoodCandidate({
    query: input.parsedName,
    candidate: rankableFromParseCandidate(input.candidate),
  });
  return (
    score.loggable &&
    score.selectionEligible &&
    confidenceForScore(score) !== 'low'
  );
}
