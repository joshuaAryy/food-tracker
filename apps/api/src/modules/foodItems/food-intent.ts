export type FoodIntentCategory =
  | 'produce'
  | 'starch'
  | 'protein'
  | 'eggs'
  | 'dairy'
  | 'spread'
  | 'toast'
  | null;

export interface FoodIntentAssessment {
  category: FoodIntentCategory;
  identityHeadMatch: boolean;
  identityAliasMatch: boolean;
  defaultSuitable: boolean;
  selectionEligible: boolean;
  scoreAdjustment: number;
  conflictsDefault: boolean;
}

function normalizeToken(value: string): string {
  const normalized = value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
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

function tokens(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/i)
    .map(normalizeToken)
    .filter((token) => token.length > 0);
}

function hasAll(values: Set<string>, required: readonly string[]): boolean {
  return required.every((value) => values.has(normalizeToken(value)));
}

function hasAny(values: Set<string>, candidates: readonly string[]): boolean {
  return candidates.some((value) => values.has(normalizeToken(value)));
}

function firstToken(value: string): string | null {
  return tokens(value).at(0) ?? null;
}

function identityAliasMatch(
  queryTokens: Set<string>,
  candidateTokens: Set<string>,
): boolean {
  const sweetPotato = ['sweet', 'potato'] as const;
  const yam = ['yam'] as const;
  return (
    (hasAll(queryTokens, sweetPotato) && hasAll(candidateTokens, yam)) ||
    (hasAll(queryTokens, yam) && hasAll(candidateTokens, sweetPotato))
  );
}

function requested(queryTokens: Set<string>, candidateTokens: Set<string>) {
  const forms = [
    ['raw'],
    ['dry'],
    ['egg', 'white'],
    ['chip'],
    ['cake'],
    ['cracker'],
    ['chocolate'],
    ['breaded'],
    ['cookie'],
    ['noodle'],
    ['sandwich'],
    ['sauce'],
    ['pudding'],
    ['oat', 'milk'],
    ['rice', 'milk'],
    ['sweet', 'potato'],
    ['dried'],
    ['powder'],
  ] as const;

  return forms.some(
    (form) => hasAll(queryTokens, form) && hasAll(candidateTokens, form),
  );
}

function categoryFor(queryTokens: Set<string>): FoodIntentCategory {
  if (hasAny(queryTokens, ['banana', 'apple'])) return 'produce';
  if (hasAny(queryTokens, ['rice', 'oat', 'oatmeal', 'potato'])) {
    return 'starch';
  }
  if (queryTokens.has('egg')) return 'eggs';
  if (hasAny(queryTokens, ['milk', 'yogurt'])) return 'dairy';
  if (hasAll(queryTokens, ['peanut', 'butter'])) return 'spread';
  if (hasAny(queryTokens, ['toast', 'bread'])) return 'toast';
  if (
    hasAny(queryTokens, ['chicken', 'beef', 'steak', 'pork', 'salmon', 'fish'])
  ) {
    return 'protein';
  }
  return null;
}

function expectedIdentity(
  category: Exclude<FoodIntentCategory, null>,
  queryTokens: Set<string>,
): string[] {
  switch (category) {
    case 'produce':
      return queryTokens.has('banana') ? ['banana'] : ['apple'];
    case 'starch':
      if (queryTokens.has('rice')) return ['rice'];
      if (hasAny(queryTokens, ['oat', 'oatmeal'])) return ['oat'];
      return ['potato'];
    case 'protein':
      if (queryTokens.has('chicken')) {
        return queryTokens.has('breast') ? ['chicken', 'breast'] : ['chicken'];
      }
      if (queryTokens.has('steak')) return ['steak'];
      if (queryTokens.has('beef')) return ['beef'];
      if (queryTokens.has('salmon')) return ['salmon'];
      if (queryTokens.has('pork')) return ['pork'];
      return ['fish'];
    case 'eggs':
      return queryTokens.has('white') ? ['egg', 'white'] : ['egg'];
    case 'dairy':
      return queryTokens.has('yogurt') ? ['yogurt'] : ['milk'];
    case 'spread':
      return ['peanut', 'butter'];
    case 'toast':
      return queryTokens.has('toast') ? ['toast'] : ['bread'];
  }
}

function allowedHeads(
  category: Exclude<FoodIntentCategory, null>,
  queryTokens: Set<string>,
): string[] {
  switch (category) {
    case 'produce':
      return ['banana', 'apple'];
    case 'starch':
      return ['rice', 'oat', 'oatmeal', 'potato'];
    case 'protein':
      return ['chicken', 'beef', 'steak', 'pork', 'salmon', 'fish'];
    case 'eggs':
      return ['egg'];
    case 'dairy':
      return queryTokens.has('yogurt') ? ['yogurt'] : ['milk'];
    case 'spread':
      return ['peanut'];
    case 'toast':
      return ['toast', 'bread'];
  }
}

function conflicts(
  category: Exclude<FoodIntentCategory, null>,
  candidateTokens: Set<string>,
  queryTokens: Set<string>,
) {
  const productForms = [
    'snack',
    'cake',
    'cookie',
    'sandwich',
    'cereal',
    'flour',
    'cracker',
    'candy',
    'chocolate',
    'breaded',
    'deli',
    'lunchmeat',
    'prepackaged',
    'chip',
  ];
  const hasUnrequested = (values: readonly string[]) =>
    values.some(
      (value) => candidateTokens.has(value) && !queryTokens.has(value),
    );
  if (hasUnrequested(productForms)) return true;

  switch (category) {
    case 'produce':
      return hasUnrequested([
        'dried',
        'dehydrated',
        'powder',
        'baked',
        'nectar',
      ]);
    case 'starch':
      return hasUnrequested([
        'raw',
        'dry',
        'noodle',
        'milk',
        'glutinous',
        'bran',
      ]);
    case 'protein':
      return hasUnrequested([
        'raw',
        'frozen',
        'pasteurized',
        'sauce',
        'tartare',
        'teriyaki',
        'meatless',
      ]);
    case 'eggs':
      return hasUnrequested(['raw', 'frozen', 'pasteurized', 'white']);
    case 'dairy':
      return hasUnrequested([
        'blueberry',
        'strawberry',
        'vanilla',
        'malted',
        'dessert',
        'shake',
        'human',
        'sheep',
        'goat',
        'chocolate',
        'evaporated',
        'condensed',
        'buttermilk',
      ]);
    case 'spread':
      return false;
    case 'toast':
      return candidateTokens.has('egg') && !queryTokens.has('egg');
  }
}

function preferred(
  category: Exclude<FoodIntentCategory, null>,
  values: Set<string>,
) {
  switch (category) {
    case 'produce':
      return hasAny(values, ['raw', 'fresh', 'whole']);
    case 'starch':
      return hasAny(values, ['cooked', 'plain', 'boiled', 'baked', 'steamed']);
    case 'protein':
      return hasAny(values, [
        'cooked',
        'grilled',
        'roasted',
        'broiled',
        'baked',
      ]);
    case 'eggs':
      return hasAny(values, ['cooked', 'boiled', 'scrambled']);
    case 'dairy':
      return hasAny(values, ['fluid', 'plain']);
    case 'spread':
      return hasAny(values, ['plain', 'creamy', 'smooth', 'reduced']);
    case 'toast':
      return values.has('toast');
  }
}

/** Returns one safe USDA metadata fallback; callers must issue at most one. */
export function foodIntentFallbackQuery(query: string): string | null {
  const normalizedQuery = query.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const queryTokens = new Set(tokens(query));
  const explicitRequest = requested(queryTokens, queryTokens);
  if (hasAll(queryTokens, ['chicken', 'breaded']) && !queryTokens.has('raw')) {
    return 'chicken breaded cooked';
  }
  if (explicitRequest) return null;
  if (hasAll(queryTokens, ['boiled', 'egg'])) return 'egg cooked boiled';
  if (hasAll(queryTokens, ['scrambled', 'egg'])) return 'egg cooked scrambled';
  if (queryTokens.has('egg') && !queryTokens.has('white')) return 'egg cooked';
  if (queryTokens.has('steak')) return 'beef steak cooked';
  if (normalizedQuery === 'oatmeal') return 'oats';
  if (queryTokens.has('oat')) return 'oatmeal';
  if (hasAll(queryTokens, ['chicken', 'breast']))
    return 'chicken breast grilled';
  if (queryTokens.has('rice') && !queryTokens.has('cooked'))
    return 'rice cooked plain';
  if (hasAll(queryTokens, ['cooked', 'rice'])) return 'rice cooked plain';
  if (queryTokens.has('milk') && !queryTokens.has('chocolate'))
    return 'milk whole fluid';
  if (hasAll(queryTokens, ['greek', 'yogurt'])) return 'greek yogurt plain';
  if (hasAll(queryTokens, ['peanut', 'butter'])) return 'peanut butter creamy';
  if (queryTokens.has('salmon')) return 'salmon cooked';
  if (queryTokens.has('potato') && !queryTokens.has('cooked'))
    return 'cooked potato';
  if (hasAll(queryTokens, ['cooked', 'potato'])) return 'potato';
  return null;
}

export function assessFoodIntent(input: {
  query: string;
  candidateName: string;
}): FoodIntentAssessment {
  const queryTokens = new Set(tokens(input.query));
  const candidateTokens = new Set(tokens(input.candidateName));
  const aliasMatches = identityAliasMatch(queryTokens, candidateTokens);
  const category = categoryFor(queryTokens);
  if (category === null) {
    return {
      category,
      identityHeadMatch: false,
      identityAliasMatch: aliasMatches,
      defaultSuitable: true,
      selectionEligible: true,
      scoreAdjustment: 0,
      conflictsDefault: false,
    };
  }

  const identityMatches =
    hasAll(candidateTokens, expectedIdentity(category, queryTokens)) ||
    aliasMatches;
  const head = firstToken(input.candidateName);
  const explicitlyRequested = requested(queryTokens, candidateTokens);
  const safeHead =
    aliasMatches ||
    (head !== null &&
      (allowedHeads(category, queryTokens).includes(head) ||
        queryTokens.has(head)));
  const conflictsDefault =
    conflicts(category, candidateTokens, queryTokens) || !safeHead;
  const nonOverridableConflict = candidateTokens.has('meatless');
  const preferredDefault = preferred(category, candidateTokens);
  const neutralDefault =
    category === 'produce' ||
    category === 'dairy' ||
    category === 'spread' ||
    (category === 'protein' && !conflictsDefault) ||
    (category === 'eggs' && !conflictsDefault);
  const defaultSuitable =
    identityMatches &&
    safeHead &&
    !conflictsDefault &&
    !nonOverridableConflict &&
    (preferredDefault || neutralDefault || explicitlyRequested);

  return {
    category,
    identityHeadMatch: identityMatches && safeHead,
    identityAliasMatch: aliasMatches,
    defaultSuitable,
    selectionEligible:
      identityMatches && safeHead && (defaultSuitable || explicitlyRequested),
    scoreAdjustment: conflictsDefault
      ? -80
      : explicitlyRequested
        ? 48
        : preferredDefault
          ? 34
          : 0,
    conflictsDefault: conflictsDefault || nonOverridableConflict,
  };
}
