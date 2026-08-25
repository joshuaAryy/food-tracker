import { describe, expect, it } from 'vitest';
import {
  assessFoodCandidateAdequacy,
  classifyQueryTokens,
  confidenceForScore,
  queryVariants,
  rankableFromParseCandidate,
  rankParseCandidates,
  scoreFoodCandidate,
} from '../src/modules/foodItems/candidate-ranking.js';
import type { AiFoodParseCandidate, FoodItem } from '@food-tracker/shared';
import {
  assessFoodIntent,
  foodIntentFallbackQuery,
} from '../src/modules/foodItems/food-intent.js';

function candidate(
  overrides: Partial<
    Parameters<typeof scoreFoodCandidate>[0]['candidate']
  > = {},
): Parameters<typeof scoreFoodCandidate>[0]['candidate'] {
  return {
    name: 'Banana',
    brandName: null,
    foodType: 'generic',
    source: 'usda_fdc',
    calories: 100,
    protein: 1,
    carbs: 20,
    fat: 0.3,
    fiber: 2,
    sugar: 12,
    sodium: null,
    nutrientCount: 1,
    servingQuantity: 100,
    servingUnit: 'g',
    servingWeightGrams: 100,
    ...overrides,
  };
}

function foodItemCandidateForRegion(region: string): AiFoodParseCandidate {
  return {
    candidateType: 'food_item' as const,
    foodItem: {
      id: `food-${region}`,
      name: 'Plain yogurt',
      brandName: null,
      sourceType: 'app_owned' as const,
      foodType: 'generic' as const,
      sourceProvider: 'ciqual' as const,
      sourceId: `ciqual-${region}`,
      sourceUpdatedAt: null,
      authoritativeAliases: [],
      sourceRegion: region,
      rankingSource: 'reference' as const,
      isSaved: false,
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      servingOptions: null,
      calories: 60,
      protein: 3,
      carbs: 4,
      fat: 3,
      fiber: null,
      sugar: null,
      sodium: null,
      additionalNutrients: null,
      nutrients: {},
      barcodes: [],
      createdAt: '',
      updatedAt: '',
    } satisfies FoodItem,
    externalFood: null,
    rank: 1,
    matchReason: 'reference' as const,
    confidence: 'low' as const,
    defaultServingMultiplier: 1,
  };
}

describe('candidate ranking helper', () => {
  it('gives curated app and reference candidates equal base source quality', () => {
    const curated = scoreFoodCandidate({
      query: 'banana',
      candidate: candidate({ source: 'app_curated' }),
    });
    const reference = scoreFoodCandidate({
      query: 'banana',
      candidate: candidate({ source: 'reference' }),
    });
    expect(reference.score).toBe(curated.score);
  });

  it('keeps legacy USDA inputs at the neutral reference source quality', () => {
    const usda = scoreFoodCandidate({
      query: 'banana',
      candidate: candidate({ source: 'usda_fdc' }),
    });
    const reference = scoreFoodCandidate({
      query: 'banana',
      candidate: candidate({ source: 'reference' }),
    });
    expect(usda.score).toBe(reference.score);
  });

  it.each([
    { lexical: false, fuzzyDistance: 0.2, semanticScore: null },
    { lexical: false, fuzzyDistance: null, semanticScore: 0.9 },
  ] as const)(
    'does not grant trusted selection from %s evidence alone',
    (retrievalEvidence) => {
      const score = scoreFoodCandidate({
        query: 'banana',
        candidate: candidate({ retrievalEvidence }),
      });
      expect(score.visibleRelevant).toBe(true);
      expect(score.selectionEligible).toBe(false);
    },
  );

  it('uses persisted ranking source semantics for hydrated app-owned foods', () => {
    const appOwned = foodItemCandidateForRegion('CA');
    if (appOwned.candidateType !== 'food_item')
      throw new Error('expected food item candidate');
    appOwned.foodItem.rankingSource = 'app_curated';
    appOwned.matchReason = 'app';
    expect(rankableFromParseCandidate(appOwned).source).toBe('app_curated');
  });

  it('uses explicit validated locale only as a final reference tie-break', () => {
    const ranked = rankParseCandidates(
      'plain yogurt',
      [foodItemCandidateForRegion('FR'), foodItemCandidateForRegion('CA')],
      { region: 'CA' },
    );
    expect(ranked[0]?.foodItem?.sourceRegion).toBe('CA');
  });

  it('ignores invalid locale values and preserves candidate order on a tie', () => {
    const ranked = rankParseCandidates(
      'plain yogurt',
      [foodItemCandidateForRegion('FR'), foodItemCandidateForRegion('CA')],
      { region: 'Canada' },
    );
    expect(ranked[0]?.foodItem?.sourceRegion).toBe('FR');
  });

  it('creates singular and plural query variants', () => {
    expect(queryVariants('eggs')).toEqual(['eggs', 'egg']);
    expect(queryVariants('bananas')).toEqual(['bananas', 'banana']);
  });

  it('separates compound identity tokens from preparation and preference modifiers', () => {
    expect(classifyQueryTokens('sweet potato').coreFoodTokens).toEqual([
      'sweet',
      'potato',
    ]);
    expect(classifyQueryTokens('egg sandwich').coreFoodTokens).toEqual([
      'egg',
      'sandwich',
    ]);
    expect(classifyQueryTokens('whole milk').coreFoodTokens).toEqual([
      'whole',
      'milk',
    ]);
    expect(classifyQueryTokens('turkey breast').coreFoodTokens).toEqual([
      'turkey',
      'breast',
    ]);
    expect(
      classifyQueryTokens('plain lowfat reduced sodium grilled salmon')
        .modifierTokens,
    ).toEqual(['plain', 'lowfat', 'reduced', 'sodium', 'grilled']);
  });

  it.each([
    [
      'sweet potato',
      'Sweet potato, cooked, baked in skin',
      'Potatoes, boiled, cooked in skin',
    ],
    ['sweet potato', 'Yam, cooked, boiled', 'Potatoes, boiled, cooked in skin'],
    ['rice noodles', 'Rice noodles, cooked', 'Rice, cooked, NFS'],
    ['egg sandwich', 'Egg sandwich on bread', 'Egg, whole, cooked'],
  ])(
    'ranks the complete %s identity above a partial identity',
    (query, completeName, partialName) => {
      const complete = scoreFoodCandidate({
        query,
        candidate: candidate({ name: completeName }),
      });
      const partial = scoreFoodCandidate({
        query,
        candidate: candidate({ name: partialName }),
      });

      expect(complete.score).toBeGreaterThan(partial.score);
      expect(complete.selectionEligible).toBe(true);
      expect(partial.visibleRelevant).toBe(true);
      expect(partial.selectionEligible).toBe(false);
      expect(confidenceForScore(partial)).not.toBe('high');
    },
  );

  it('ranks fluid whole milk above unrelated and concentrated dairy foods', () => {
    const wholeMilk = scoreFoodCandidate({
      query: 'whole milk',
      candidate: candidate({ name: 'Milk, fluid, whole' }),
    });
    const alternatives = [
      'Yogurt, whole milk, plain',
      'Buttermilk, fluid, whole',
      'Milk, evaporated, whole',
    ].map((name) =>
      scoreFoodCandidate({
        query: 'whole milk',
        candidate: candidate({ name }),
      }),
    );

    expect(wholeMilk.selectionEligible).toBe(true);
    for (const alternative of alternatives) {
      expect(wholeMilk.score).toBeGreaterThan(alternative.score);
      expect(alternative.selectionEligible).toBe(false);
    }
  });

  it.each([
    ['oat milk', 'Oat milk, plain', 'Oatmeal, cooked'],
    ['steak sauce', 'Steak sauce', 'Beef steak, grilled'],
    ['banana pudding', 'Banana pudding', 'Bananas, raw'],
    [
      'peanut butter cookies',
      'Cookies, peanut butter',
      'Peanut butter, creamy',
    ],
  ])(
    'preserves the explicitly requested compound form for %s',
    (query, completeName, partialName) => {
      const complete = scoreFoodCandidate({
        query,
        candidate: candidate({ name: completeName }),
      });
      const partial = scoreFoodCandidate({
        query,
        candidate: candidate({ name: partialName }),
      });

      expect(complete.score).toBeGreaterThan(partial.score);
      expect(complete.selectionEligible).toBe(true);
      expect(partial.selectionEligible).toBe(false);
    },
  );

  it.each([
    ['banana', 'Bananas, raw'],
    ['rice', 'Rice, cooked'],
    ['cooked rice', 'Rice, cooked'],
    ['boiled egg', 'Egg, whole, cooked, hard-boiled'],
    ['raw salmon', 'Salmon, Atlantic, raw'],
  ])(
    'keeps simple and preparation-qualified %s selection-safe',
    (query, name) => {
      const score = scoreFoodCandidate({
        query,
        candidate: candidate({ name }),
      });

      expect(score.selectionEligible).toBe(true);
    },
  );

  it('scores exact and singular plural matches as high confidence', () => {
    const exact = scoreFoodCandidate({
      query: 'banana',
      candidate: candidate({ name: 'banana' }),
    });
    const plural = scoreFoodCandidate({
      query: 'bananas',
      candidate: candidate({ name: 'Banana' }),
    });

    expect(confidenceForScore(exact)).toBe('high');
    expect(confidenceForScore(plural)).toBe('high');
    expect(plural.relevant).toBe(true);
  });

  it('rewards candidates that contain all meaningful query tokens', () => {
    const greekPlain = scoreFoodCandidate({
      query: 'Greek yogurt',
      candidate: candidate({ name: 'Yogurt, Greek, plain' }),
    });
    const yogurtOnly = scoreFoodCandidate({
      query: 'Greek yogurt',
      candidate: candidate({ name: 'Yogurt, plain' }),
    });

    expect(greekPlain.score).toBeGreaterThan(yogurtOnly.score);
    expect(confidenceForScore(greekPlain)).toBe('high');
  });

  it('penalizes branded candidates for unbranded queries and allows branded queries to override it', () => {
    const unbrandedQuery = scoreFoodCandidate({
      query: 'peanut butter',
      candidate: candidate({
        name: 'Peanut butter',
        brandName: 'Acme Foods',
        foodType: 'branded',
        source: 'cached_external',
      }),
    });
    const brandedQuery = scoreFoodCandidate({
      query: 'Acme peanut butter',
      candidate: candidate({
        name: 'Peanut butter',
        brandName: 'Acme Foods',
        foodType: 'branded',
        source: 'cached_external',
      }),
    });

    expect(unbrandedQuery.penalties).toContain('branded_mismatch');
    expect(confidenceForScore(unbrandedQuery)).toBe('low');
    expect(brandedQuery.penalties).not.toContain('branded_mismatch');
    expect(brandedQuery.score).toBeGreaterThan(unbrandedQuery.score);
  });

  it('penalizes strong negative descriptors only when not requested', () => {
    const rawBanana = scoreFoodCandidate({
      query: 'banana',
      candidate: candidate({ name: 'Bananas, raw' }),
    });
    const dehydratedBanana = scoreFoodCandidate({
      query: 'banana',
      candidate: candidate({ name: 'Bananas, dehydrated, powder' }),
    });
    const driedApple = scoreFoodCandidate({
      query: 'dried apple',
      candidate: candidate({ name: 'Apples, dried' }),
    });
    const proteinPowder = scoreFoodCandidate({
      query: 'protein powder',
      candidate: candidate({ name: 'Protein powder' }),
    });

    expect(dehydratedBanana.score).toBeLessThan(rawBanana.score);
    expect(dehydratedBanana.penalties).toContain('negative_descriptor');
    expect(driedApple.penalties).not.toContain('negative_descriptor');
    expect(proteinPowder.penalties).not.toContain('negative_descriptor');
    expect(confidenceForScore(driedApple)).toBe('high');
  });

  it('does not penalize milk for fluid or beverage wording', () => {
    const milk = scoreFoodCandidate({
      query: 'milk',
      candidate: candidate({ name: 'Milk, fluid, whole' }),
    });
    const milkBeverage = scoreFoodCandidate({
      query: 'milk',
      candidate: candidate({ name: 'Milk beverage, fluid' }),
    });

    expect(milk.penalties).not.toContain('negative_descriptor');
    expect(milkBeverage.penalties).not.toContain('negative_descriptor');
    expect(confidenceForScore(milk)).not.toBe('low');
  });

  it('prefers category-aware forms without hiding valid dry or raw candidates', () => {
    const cookedRice = scoreFoodCandidate({
      query: 'cooked rice',
      candidate: candidate({ name: 'Rice, white, cooked' }),
    });
    const dryRice = scoreFoodCandidate({
      query: 'rice',
      candidate: candidate({ name: 'Rice, white, dry' }),
    });
    const dryRiceForCookedQuery = scoreFoodCandidate({
      query: 'cooked rice',
      candidate: candidate({ name: 'Rice, white, dry' }),
    });
    const chickenBreast = scoreFoodCandidate({
      query: 'chicken breast',
      candidate: candidate({ name: 'Chicken, broiler, breast, meat only' }),
    });
    const chickenPreparedMeal = scoreFoodCandidate({
      query: 'chicken breast',
      candidate: candidate({
        name: 'Chicken breast prepared meal, restaurant',
      }),
    });

    expect(dryRice.visibleRelevant).toBe(true);
    expect(dryRice.selectionEligible).toBe(false);
    expect(cookedRice.score).toBeGreaterThan(dryRiceForCookedQuery.score);
    expect(chickenBreast.score).toBeGreaterThan(chickenPreparedMeal.score);
    expect(chickenPreparedMeal.penalties).toContain('negative_descriptor');
  });

  it('requires a core food token before modifier matches become relevant', () => {
    const boiledEgg = scoreFoodCandidate({
      query: 'boiled egg',
      candidate: candidate({ name: 'Egg, whole, cooked, hard-boiled' }),
    });
    const boiledKale = scoreFoodCandidate({
      query: 'boiled egg',
      candidate: candidate({ name: 'Kale, frozen, cooked, boiled' }),
    });

    expect(confidenceForScore(boiledEgg)).toBe('high');
    expect(boiledKale.relevant).toBe(false);
    expect(confidenceForScore(boiledKale)).toBe('low');
    expect(boiledEgg.score).toBeGreaterThan(boiledKale.score);
  });

  it('requires every core token for multi-token foods to be high confidence', () => {
    const plainPeanutButter = scoreFoodCandidate({
      query: 'peanut butter',
      candidate: candidate({ name: 'Peanut butter, smooth style' }),
    });
    const peanutCandy = scoreFoodCandidate({
      query: 'peanut butter',
      candidate: candidate({ name: 'Candies, peanut coating' }),
    });

    expect(confidenceForScore(plainPeanutButter)).toBe('high');
    expect(confidenceForScore(peanutCandy)).not.toBe('high');
  });

  it.each([
    ['rice', 'Rice, white, cooked', 'Rice crackers'],
    ['cooked rice', 'Rice, white, cooked', 'Kale, frozen, cooked, boiled'],
    ['milk', 'Milk, fluid, whole', 'Milk chocolate'],
    ['banana', 'Bananas, raw', 'Banana chips'],
    [
      'chicken breast',
      'Chicken, breast, meat only, raw',
      'Chicken breast tenders, breaded, uncooked',
    ],
    [
      'Greek yogurt',
      'Yogurt, Greek, plain, lowfat',
      'Yogurt, Greek, Blueberry, CHOBANI',
    ],
    [
      'peanut butter',
      'Peanut butter, smooth style',
      'Candies, REESES Peanut Butter Cups',
    ],
  ])(
    '%s ranks the intended food above its misleading match',
    (query, good, bad) => {
      const intended = scoreFoodCandidate({
        query,
        candidate: candidate({ name: good }),
      });
      const misleading = scoreFoodCandidate({
        query,
        candidate: candidate({
          name: bad,
          ...(query === 'Greek yogurt'
            ? { brandName: 'CHOBANI', foodType: 'branded' as const }
            : {}),
        }),
      });

      expect(intended.score).toBeGreaterThan(misleading.score);
    },
  );

  it.each([
    ['rice crackers', 'Rice crackers'],
    ['milk chocolate', 'Milk chocolate'],
    ['banana chips', 'Banana chips'],
  ])('keeps requested form terms relevant for %s', (query, name) => {
    const score = scoreFoodCandidate({ query, candidate: candidate({ name }) });

    expect(score.penalties).not.toContain('negative_descriptor');
    expect(confidenceForScore(score)).toBe('high');
  });

  it('does not make a single core-token product-form match high confidence', () => {
    const cookedRice = scoreFoodCandidate({
      query: 'rice',
      candidate: candidate({ name: 'Rice, white, cooked' }),
    });
    const riceCakes = scoreFoodCandidate({
      query: 'rice',
      candidate: candidate({ name: 'Snacks, rice cakes, brown rice' }),
    });

    expect(confidenceForScore(cookedRice)).toBe('high');
    expect(confidenceForScore(riceCakes)).not.toBe('high');
    expect(cookedRice.score).toBeGreaterThan(riceCakes.score);
  });

  it.each([
    [
      'Greek yogurt',
      'Yogurt, Greek, plain, lowfat',
      'Yogurt, Greek, blueberry',
    ],
    [
      'peanut butter',
      'Peanut butter, creamy',
      'Cookies, peanut butter sandwich',
    ],
    [
      'chicken breast',
      'Chicken, breast, boneless, skinless, cooked, roasted',
      'Chicken breast, deli, honey glazed, prepackaged',
    ],
  ])(
    'keeps plain defaults above unrequested product forms for %s',
    (query, plain, product) => {
      const defaultFood = scoreFoodCandidate({
        query,
        candidate: candidate({ name: plain }),
      });
      const productForm = scoreFoodCandidate({
        query,
        candidate: candidate({ name: product }),
      });

      expect(confidenceForScore(defaultFood)).toBe('high');
      expect(confidenceForScore(productForm)).not.toBe('high');
      expect(defaultFood.score).toBeGreaterThan(productForm.score);
    },
  );

  it.each([
    ['rice cakes', 'Rice cakes'],
    ['peanut butter cookies', 'Peanut butter cookies'],
    ['breaded chicken', 'Chicken breast tenders, breaded, uncooked'],
  ])(
    'keeps requested product forms eligible for high confidence for %s',
    (query, name) => {
      const score = scoreFoodCandidate({
        query,
        candidate: candidate({ name }),
      });

      expect(score.penalties).not.toContain('negative_descriptor');
      expect(confidenceForScore(score)).toBe('high');
    },
  );

  it('prefers whole egg over processed egg white for a plain eggs query', () => {
    const wholeEgg = scoreFoodCandidate({
      query: 'eggs',
      candidate: candidate({ name: 'Egg, whole, cooked, hard-boiled' }),
    });
    const processedWhite = scoreFoodCandidate({
      query: 'eggs',
      candidate: candidate({ name: 'Egg, white, raw, frozen, pasteurized' }),
    });

    expect(confidenceForScore(wholeEgg)).toBe('high');
    expect(confidenceForScore(processedWhite)).toBe('low');
    expect(wholeEgg.score).toBeGreaterThan(processedWhite.score);
  });

  it.each([
    ['rice', 'Rice, white, dry', 'Rice, white, cooked'],
    [
      'chicken breast',
      'Chicken, breast, meat only, raw',
      'Chicken, breast, meat only, cooked, roasted',
    ],
    ['eggs', 'Egg, whole, raw', 'Egg, whole, cooked, scrambled'],
    ['steak', 'Beef steak, raw', 'Beef steak, grilled'],
  ])(
    'keeps raw or dry %s alternatives visible without making them selection-safe',
    (query, rawOrDry, edibleDefault) => {
      const alternative = scoreFoodCandidate({
        query,
        candidate: candidate({ name: rawOrDry }),
      });
      const defaultFood = scoreFoodCandidate({
        query,
        candidate: candidate({ name: edibleDefault }),
      });

      expect(alternative.visibleRelevant).toBe(true);
      expect(alternative.selectionEligible).toBe(false);
      expect(defaultFood.selectionEligible).toBe(true);
      expect(confidenceForScore(defaultFood)).toBe('high');
    },
  );

  it.each([
    ['raw chicken', 'Chicken, breast, meat only, raw'],
    ['dry rice', 'Rice, white, dry'],
    ['raw egg', 'Egg, whole, raw'],
    ['egg white', 'Egg, white, raw'],
    ['raw steak', 'Beef steak, raw'],
  ])(
    'makes explicitly requested states selection-safe for %s',
    (query, name) => {
      const score = scoreFoodCandidate({
        query,
        candidate: candidate({ name }),
      });

      expect(score.visibleRelevant).toBe(true);
      expect(score.selectionEligible).toBe(true);
    },
  );

  it('rejects a composite egg-bread candidate as selection-safe for eggs and toast', () => {
    const eggScore = scoreFoodCandidate({
      query: 'eggs',
      candidate: candidate({ name: 'Bread, egg, toasted' }),
    });
    const toastScore = scoreFoodCandidate({
      query: 'toast',
      candidate: candidate({ name: 'Bread, egg, toasted' }),
    });

    expect(eggScore.selectionEligible).toBe(false);
    expect(toastScore.selectionEligible).toBe(false);
    expect(eggScore.visibleRelevant).toBe(false);
  });

  it('keeps a requested cookie-form candidate visible and selection-safe when its product head comes first', () => {
    const score = scoreFoodCandidate({
      query: 'peanut butter cookies',
      candidate: candidate({ name: 'Cookies, peanut butter' }),
    });

    expect(score.visibleRelevant).toBe(true);
    expect(score.selectionEligible).toBe(true);
    expect(confidenceForScore(score)).toBe('high');
  });

  it('does not mark unrequested peanut butter cookies as selection-safe', () => {
    expect(
      assessFoodIntent({
        query: 'peanut butter',
        candidateName: 'Peanut butter cookies',
      }).selectionEligible,
    ).toBe(false);
  });

  it('applies compatible visibility rules to cached and external candidates', () => {
    for (const name of [
      'Potatoes, boiled, cooked in skin, flesh',
      'Yogurt, Greek, plain, lowfat',
      'Peanut butter, creamy',
      'Cookies, peanut butter, commercially prepared, regular',
    ]) {
      const query = name.startsWith('Potatoes')
        ? 'potato'
        : name.startsWith('Yogurt')
          ? 'Greek yogurt'
          : name.startsWith('Cookies')
            ? 'peanut butter cookies'
            : 'peanut butter';
      const cached = scoreFoodCandidate({
        query,
        candidate: candidate({ name, source: 'cached_external' }),
      });
      const external = scoreFoodCandidate({
        query,
        candidate: candidate({ name, source: 'usda_fdc' }),
      });

      expect(cached.visibleRelevant, name).toBe(external.visibleRelevant);
      expect(cached.selectionEligible, name).toBe(external.selectionEligible);
      expect(cached.visibleRelevant, name).toBe(true);
      expect(cached.selectionEligible, name).toBe(true);
    }
  });

  it.each([
    ['rice', 'rice cooked plain'],
    ['cooked rice', 'rice cooked plain'],
    ['eggs', 'egg cooked'],
    ['boiled egg', 'egg cooked boiled'],
    ['scrambled eggs', 'egg cooked scrambled'],
    ['chicken breast', 'chicken breast grilled'],
    ['breaded chicken', 'chicken breaded cooked'],
    ['steak', 'beef steak cooked'],
    ['beef steak', 'beef steak cooked'],
    ['salmon', 'salmon cooked'],
    ['oats', 'oatmeal'],
    ['oatmeal', 'oats'],
    ['potato', 'cooked potato'],
    ['banana chips', null],
    ['rice cakes', null],
    ['milk', 'milk whole fluid'],
    ['Greek yogurt', 'greek yogurt plain'],
    ['peanut butter', 'peanut butter creamy'],
    ['milk chocolate', null],
    ['peanut butter cookies', null],
    ['egg white', null],
    ['raw chicken', null],
    ['dry rice', null],
    ['raw steak', null],
  ])('uses one safe fallback for %s', (query, fallback) => {
    expect(foodIntentFallbackQuery(query)).toBe(fallback);
  });

  it.each([
    ['rice', 'Rice, white, cooked', 'Rice, cooked with milk'],
    ['rice', 'Rice, white, cooked', 'Rice noodles, cooked'],
    ['milk', 'Milk, whole, fluid', 'Milk, malted'],
    ['steak', 'Beef, steak, grilled', 'Steak sauce'],
    ['oats', 'Oatmeal, cooked', 'Oat bran, cooked'],
    ['oatmeal', 'Oatmeal, cooked', 'Oat milk, plain'],
    ['banana', 'Bananas, raw', 'Banana, baked'],
    [
      'chicken breast',
      'Chicken breast, grilled',
      'Chicken breast, cooked with sauce',
    ],
    [
      'breaded chicken',
      'Chicken breast, breaded, cooked',
      'Meatless chicken, breaded',
    ],
  ])(
    'keeps %s edible defaults above inadequate forms',
    (query, adequateName, inadequateName) => {
      const adequate = scoreFoodCandidate({
        query,
        candidate: candidate({ name: adequateName }),
      });
      const inadequate = scoreFoodCandidate({
        query,
        candidate: candidate({ name: inadequateName }),
      });

      expect(adequate.defaultSuitable).toBe(true);
      expect(adequate.selectionEligible).toBe(true);
      expect(inadequate.defaultSuitable).toBe(false);
      expect(inadequate.selectionEligible).toBe(false);
      expect(adequate.score).toBeGreaterThan(inadequate.score);
    },
  );

  it.each([
    ['banana', 'Bananas, raw', 'Banana chips'],
    ['apple', 'Apples, raw, with skin', 'Apples, dried'],
    ['rice', 'Rice, white, cooked', 'Rice crackers'],
    ['cooked rice', 'Rice, white, cooked', 'Rice, white, dry'],
    [
      'chicken breast',
      'Chicken, breast, meat only, cooked, roasted',
      'Chicken breast, deli, honey glazed, prepackaged',
    ],
    [
      'eggs',
      'Egg, whole, cooked, scrambled',
      'Egg, white, frozen, pasteurized',
    ],
    ['milk', 'Milk, fluid, whole', 'Milk chocolate'],
    [
      'Greek yogurt',
      'Yogurt, Greek, plain, lowfat',
      'Yogurt, Greek, blueberry',
    ],
    ['peanut butter', 'Peanut butter, creamy', 'Peanut butter cookies'],
    ['steak', 'Beef steak, grilled', 'Beef steak, raw'],
    ['salmon', 'Salmon, Atlantic, cooked, dry heat', 'Salmon, Atlantic, raw'],
    ['oats', 'Oats, cooked', 'Oats, dry'],
    ['potato', 'Potato, baked, flesh and skin', 'Potato flour'],
  ])(
    '%s makes the edible default selection-safe while retaining the relevant alternative',
    (query, defaultName, alternativeName) => {
      const defaultFood = scoreFoodCandidate({
        query,
        candidate: candidate({ name: defaultName }),
      });
      const alternative = scoreFoodCandidate({
        query,
        candidate: candidate({ name: alternativeName }),
      });

      expect(defaultFood.visibleRelevant).toBe(true);
      expect(defaultFood.selectionEligible).toBe(true);
      expect(confidenceForScore(defaultFood)).toBe('high');
      expect(alternative.visibleRelevant).toBe(true);
      expect(alternative.selectionEligible).toBe(false);
      expect(defaultFood.score).toBeGreaterThan(alternative.score);
    },
  );

  it('marks product-only rice metadata inadequate until cooked plain rice is available', () => {
    const inadequate = assessFoodCandidateAdequacy({
      query: 'rice',
      candidateNames: [
        'Rice noodles, cooked',
        'Rice, cooked with milk',
        'Rice cakes',
      ],
    });
    const adequate = assessFoodCandidateAdequacy({
      query: 'rice',
      candidateNames: ['Rice noodles, cooked', 'Rice, white, cooked'],
    });

    expect(inadequate.hasAdequateCandidate).toBe(false);
    expect(inadequate.mostlyInadequate).toBe(true);
    expect(adequate.hasAdequateCandidate).toBe(true);
    expect(adequate.topCandidateAdequate).toBe(false);
  });

  it('uses an exact authoritative alias for deterministic identity', () => {
    const score = scoreFoodCandidate({
      query: 'œuf',
      candidate: candidate({
        name: 'Egg, chicken, whole, raw',
        authoritativeAliases: ['Œuf de poule entier cru'],
      }),
    });
    expect(score.visibleRelevant).toBe(true);
    expect(score.strongIdentityMatch).toBe(true);
    expect(score.selectionEligible).toBe(true);
  });

  it('matches accented and unaccented authoritative aliases', () => {
    const accented = candidate({
      name: 'Crème fraîche',
      authoritativeAliases: ['Crème fraîche entière'],
    });
    expect(
      scoreFoodCandidate({ query: 'creme', candidate: accented })
        .visibleRelevant,
    ).toBe(true);
    expect(
      scoreFoodCandidate({ query: 'crème', candidate: accented })
        .visibleRelevant,
    ).toBe(true);
  });

  it('does not let category-only search metadata create identity', () => {
    const score = scoreFoodCandidate({
      query: 'vegetable',
      candidate: candidate({ name: 'Chicken breast' }),
    });
    expect(score.visibleRelevant).toBe(false);
  });

  it('keeps preparation safeguards active when an alias matches', () => {
    const score = scoreFoodCandidate({
      query: 'œuf grilled',
      candidate: candidate({
        name: 'Egg, chicken, whole, raw',
        authoritativeAliases: ['Œuf de poule entier cru'],
      }),
    });
    expect(score.visibleRelevant).toBe(true);
    expect(score.selectionEligible).toBe(false);
  });
});
