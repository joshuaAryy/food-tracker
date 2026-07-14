import { PHOTO_ANALYSIS_MAX_BYTES } from '@food-tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { photoAnalysisConfig } from '../src/modules/ai/photo-config.js';
import { parseProviderOutput } from '../src/modules/ai/photo-provider.js';
import { adaptPhotoRepresentations } from '../src/modules/ai/photo-representation.js';
import { api, expectErrorEnvelope } from './helpers/api.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

const noResponsibleEstimate = {
  quantityState: 'no_responsible_estimate' as const,
  quantityAmount: null,
  quantityUnit: null,
  quantityCountLabel: null,
  quantityRawText: null,
  quantityConfidence: null,
};

function estimatedQuantity(
  amount: number,
  unit:
    | 'count'
    | 'slice'
    | 'piece'
    | 'tablespoon'
    | 'teaspoon'
    | 'cup'
    | 'millilitre'
    | 'gram'
    | 'ounce',
  rawText: string,
  confidence: 'high' | 'medium' | 'low',
  countLabel: string | null = null,
) {
  return {
    quantityState: 'estimated' as const,
    quantityAmount: amount,
    quantityUnit: unit,
    quantityCountLabel: countLabel,
    quantityRawText: rawText,
    quantityConfidence: confidence,
  };
}

function representationItem(input: {
  name: string;
  groupKey: string;
  mode: 'decomposed' | 'composite';
  kind: 'component' | 'composite';
  active?: boolean;
  coverage?: string[];
  excludedCoverage?: string[];
  region?: { x: number; y: number; width: number; height: number } | null;
}) {
  return {
    name: input.name,
    preparationForm: null,
    identityConfidence: 'high' as const,
    region: input.region ?? null,
    ...estimatedQuantity(1, 'gram', '1 gram', 'medium'),
    groupKey: input.groupKey,
    representationMode: input.mode,
    representationKind: input.kind,
    active: input.active ?? true,
    coverage: input.coverage ?? [input.name],
    excludedCoverage: input.excludedCoverage ?? [],
    representationConfidence: 'high' as const,
    visiblePortionDescription: null,
  };
}

function adaptRepresentationItems(
  items: ReturnType<typeof representationItem>[],
) {
  return adaptPhotoRepresentations(
    parseProviderOutput(JSON.stringify({ items })),
  );
}

async function createTrustedFood(name: string) {
  return prisma.foodItem.create({
    data: {
      name,
      normalizedName: name.toLocaleLowerCase(),
      searchText: name.toLocaleLowerCase(),
      sourceType: 'app_owned',
      foodType: 'generic',
      servingQuantity: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      calories: 165,
      protein: 31,
    },
  });
}

describe('photo food analysis API', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = 'mock';
    process.env.PHOTO_ANALYSIS_RATE_LIMIT_MAX = '100';
    process.env.PHOTO_ANALYSIS_DAILY_LIMIT = '100';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
    delete process.env.PHOTO_ANALYSIS_MAX_OUTPUT_TOKENS;
    delete process.env.PHOTO_ANALYSIS_RATE_LIMIT_MAX;
    delete process.env.PHOTO_ANALYSIS_DAILY_LIMIT;
  });

  it.each([
    [
      'count',
      {
        quantityState: 'estimated',
        quantityAmount: 2,
        quantityUnit: 'count',
        quantityCountLabel: 'egg',
        quantityRawText: 'approximately 2 eggs',
        quantityConfidence: 'high',
      },
    ],
    [
      'slice',
      {
        quantityState: 'estimated',
        quantityAmount: 1,
        quantityUnit: 'slice',
        quantityCountLabel: null,
        quantityRawText: '1 slice',
        quantityConfidence: 'medium',
      },
    ],
    [
      'piece',
      {
        quantityState: 'estimated',
        quantityAmount: 0.5,
        quantityUnit: 'piece',
        quantityCountLabel: null,
        quantityRawText: 'half a piece',
        quantityConfidence: 'low',
      },
    ],
    [
      'cup',
      {
        quantityState: 'estimated',
        quantityAmount: 1.5,
        quantityUnit: 'cup',
        quantityCountLabel: null,
        quantityRawText: 'approximately 1.5 cups',
        quantityConfidence: 'medium',
      },
    ],
    [
      'tablespoon',
      {
        quantityState: 'estimated',
        quantityAmount: 2,
        quantityUnit: 'tablespoon',
        quantityCountLabel: null,
        quantityRawText: 'approximately 2 tablespoons',
        quantityConfidence: 'medium',
      },
    ],
    [
      'teaspoon',
      {
        quantityState: 'estimated',
        quantityAmount: 1,
        quantityUnit: 'teaspoon',
        quantityCountLabel: null,
        quantityRawText: '1 teaspoon',
        quantityConfidence: 'medium',
      },
    ],
    [
      'millilitre',
      {
        quantityState: 'estimated',
        quantityAmount: 120,
        quantityUnit: 'millilitre',
        quantityCountLabel: null,
        quantityRawText: '120 millilitres',
        quantityConfidence: 'low',
      },
    ],
    [
      'gram',
      {
        quantityState: 'estimated',
        quantityAmount: 120,
        quantityUnit: 'gram',
        quantityCountLabel: null,
        quantityRawText: 'approximately 120 grams',
        quantityConfidence: 'low',
      },
    ],
    [
      'ounce',
      {
        quantityState: 'estimated',
        quantityAmount: 4,
        quantityUnit: 'ounce',
        quantityCountLabel: null,
        quantityRawText: '4 ounces',
        quantityConfidence: 'low',
      },
    ],
  ] as const)('accepts a structured %s quantity', (_unit, quantity) => {
    const [suggestion] = parseProviderOutput(
      JSON.stringify({
        items: [
          {
            name: 'food',
            preparationForm: null,
            identityConfidence: 'medium',
            region: null,
            ...quantity,
          },
        ],
      }),
    );

    expect(suggestion?.quantity).toEqual(quantity);
  });

  it('accepts an explicit no-responsible-estimate quantity state', () => {
    const [suggestion] = parseProviderOutput(
      JSON.stringify({
        items: [
          {
            name: 'pasta',
            preparationForm: null,
            identityConfidence: 'medium',
            region: null,
            quantityState: 'no_responsible_estimate',
            quantityAmount: null,
            quantityUnit: null,
            quantityCountLabel: null,
            quantityRawText: null,
            quantityConfidence: null,
          },
        ],
      }),
    );

    expect(suggestion?.quantity).toEqual({
      quantityState: 'no_responsible_estimate',
      quantityAmount: null,
      quantityUnit: null,
      quantityCountLabel: null,
      quantityRawText: null,
      quantityConfidence: null,
    });
  });

  it.each([
    ['full image', { x: 0, y: 0, width: 1, height: 1 }],
    ['small region', { x: 0.1, y: 0.2, width: 0.2, height: 0.3 }],
    ['decimal bounds', { x: 0.333, y: 0.125, width: 0.5, height: 0.25 }],
  ])('preserves a valid %s region', (_label, region) => {
    const [suggestion] = parseProviderOutput(
      JSON.stringify({
        items: [
          {
            name: 'food',
            preparationForm: null,
            identityConfidence: 'high',
            region,
            ...estimatedQuantity(
              2,
              'count',
              'approximately 2 eggs',
              'high',
              'egg',
            ),
          },
        ],
      }),
    );

    expect(suggestion?.region).toEqual(region);
    expect(suggestion?.quantity).toMatchObject({
      quantityState: 'estimated',
      quantityAmount: 2,
      quantityUnit: 'count',
      quantityCountLabel: 'egg',
    });
    expect(suggestion?.identityConfidence).toBe('high');
  });

  it.each([
    ['missing', undefined],
    ['explicit null', null],
  ])('accepts a %s optional region', (_label, region) => {
    const [suggestion] = parseProviderOutput(
      JSON.stringify({
        items: [
          {
            name: 'food',
            preparationForm: null,
            identityConfidence: 'medium',
            ...(region === undefined ? {} : { region }),
            ...estimatedQuantity(120, 'gram', '120 grams', 'medium'),
          },
        ],
      }),
    );

    expect(suggestion?.region).toBeNull();
  });

  it.each([
    ['negative coordinate', { x: -0.1, y: 0, width: 0.2, height: 0.2 }],
    ['coordinate above one', { x: 1.1, y: 0, width: 0.2, height: 0.2 }],
    ['reversed horizontal bounds', { x: 0.8, y: 0, width: -0.2, height: 0.2 }],
    ['reversed vertical bounds', { x: 0, y: 0.8, width: 0.2, height: -0.2 }],
    ['zero width', { x: 0.1, y: 0.1, width: 0, height: 0.2 }],
    ['zero height', { x: 0.1, y: 0.1, width: 0.2, height: 0 }],
    ['missing field', { x: 0.1, y: 0.1, width: 0.2 }],
    ['non-numeric field', { x: '0.1', y: 0.1, width: 0.2, height: 0.2 }],
    ['malformed object', []],
  ])('drops an invalid optional region: %s', (_label, region) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [suggestion] = parseProviderOutput(
      JSON.stringify({
        items: [
          {
            name: 'food',
            preparationForm: null,
            identityConfidence: 'high',
            region,
            ...estimatedQuantity(
              2,
              'count',
              'approximately 2 eggs',
              'high',
              'egg',
            ),
          },
        ],
      }),
    );

    expect(suggestion).toBeDefined();
    expect(suggestion?.region).toBeNull();
    expect(suggestion?.identityConfidence).toBe('high');
    expect(suggestion?.quantity).toMatchObject({
      quantityState: 'estimated',
      quantityAmount: 2,
      quantityUnit: 'count',
      quantityCountLabel: 'egg',
    });
    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:provider]',
      expect.objectContaining({
        category: 'provider_optional_region_discarded',
        itemIndex: 0,
        violationCategories: expect.any(Array),
        invalidFieldPaths: expect.any(Array),
      }),
    );
  });

  it('drops a non-finite optional region without logging coordinate values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [suggestion] = parseProviderOutput(
      '{"items":[{"name":"food","preparationForm":null,"identityConfidence":"high","quantityState":"estimated","quantityAmount":2,"quantityUnit":"count","quantityCountLabel":"egg","quantityRawText":"approximately 2 eggs","quantityConfidence":"high","region":{"x":1e999,"y":0,"width":0.2,"height":0.2}}]}',
    );

    expect(suggestion?.region).toBeNull();
    const diagnostic = warn.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(diagnostic.category).toBe('provider_optional_region_discarded');
    expect(JSON.stringify(diagnostic)).not.toContain('1e999');
    expect(JSON.stringify(diagnostic)).not.toContain('Infinity');
  });

  it('activates distinct visible components and flattens only active rows', () => {
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'eggs',
        groupKey: 'breakfast',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['eggs'],
      }),
      representationItem({
        name: 'toast',
        groupKey: 'breakfast',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['toast'],
      }),
    ]);

    expect(adapted.active).toHaveLength(2);
    expect(adapted.groups[0]).toMatchObject({
      activeRepresentation: 'decomposed',
      activeItemIds: ['photo-item-1', 'photo-item-2'],
      alternatives: [],
    });
    expect(adapted.active.map((item) => item.coverage)).toEqual([
      ['egg'],
      ['toast'],
    ]);
  });

  it('keeps one inactive composite alternative behind active components', () => {
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'cooked pasta',
        groupKey: 'pasta-dish',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['pasta'],
      }),
      representationItem({
        name: 'tomato sauce',
        groupKey: 'pasta-dish',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['tomato sauce'],
      }),
      representationItem({
        name: 'pasta with tomato sauce',
        groupKey: 'pasta-dish',
        mode: 'composite',
        kind: 'composite',
        active: false,
        coverage: ['pasta', 'tomato sauce'],
      }),
    ]);

    expect(adapted.active).toHaveLength(2);
    expect(adapted.groups[0]?.alternatives).toHaveLength(1);
    expect(adapted.groups[0]?.alternatives[0]).toMatchObject({
      active: false,
      representation: 'composite',
      itemIds: ['photo-alt-1-1-1'],
    });
    expect(adapted.groups[0]?.alternatives[0]?.items[0]).toMatchObject({
      active: false,
      representationKind: 'composite',
    });
  });

  it('keeps an inactive decomposed alternative behind an active composite', () => {
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'vegetable casserole',
        groupKey: 'casserole',
        mode: 'composite',
        kind: 'composite',
        coverage: ['vegetable casserole'],
      }),
      representationItem({
        name: 'potato',
        groupKey: 'casserole',
        mode: 'decomposed',
        kind: 'component',
        active: false,
        coverage: ['potato'],
      }),
      representationItem({
        name: 'carrot',
        groupKey: 'casserole',
        mode: 'decomposed',
        kind: 'component',
        active: false,
        coverage: ['carrot'],
      }),
    ]);

    expect(adapted.active).toHaveLength(1);
    expect(adapted.groups[0]?.activeRepresentation).toBe('composite');
    expect(adapted.groups[0]?.alternatives[0]?.items).toHaveLength(2);
    expect(
      adapted.groups[0]?.alternatives[0]?.items.every((item) => !item.active),
    ).toBe(true);
  });

  it('supports a composite alternative that excludes separately represented coverage', () => {
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'pasta',
        groupKey: 'pasta-dish',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['pasta'],
      }),
      representationItem({
        name: 'tomato sauce',
        groupKey: 'pasta-dish',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['tomato sauce'],
      }),
      representationItem({
        name: 'grated Parmesan',
        groupKey: 'pasta-dish',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['parmesan'],
      }),
      representationItem({
        name: 'pasta with tomato sauce',
        groupKey: 'pasta-dish',
        mode: 'composite',
        kind: 'composite',
        active: false,
        coverage: ['pasta', 'tomato sauce', 'parmesan'],
        excludedCoverage: ['parmesan'],
      }),
    ]);

    expect(adapted.groups[0]?.alternatives[0]).toMatchObject({
      representation: 'composite',
    });
    expect(
      adapted.groups[0]?.alternatives[0]?.items[0]?.excludedCoverage,
    ).toEqual(['parmesan']);
  });

  it.each([
    'missing active representation',
    'both representations active',
    'duplicate active coverage',
    'composite covering active components',
    'unknown exclusion',
    'decomposed representation with one component',
    'multiple inactive alternatives',
  ])('rejects invalid representation structure: %s', (caseName) => {
    const cases: Record<string, ReturnType<typeof representationItem>[]> = {
      'missing active representation': [
        representationItem({
          name: 'pasta',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
          active: false,
        }),
        representationItem({
          name: 'sauce',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
          active: false,
        }),
      ],
      'both representations active': [
        representationItem({
          name: 'pasta',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
        }),
        representationItem({
          name: 'pasta with sauce',
          groupKey: 'dish',
          mode: 'composite',
          kind: 'composite',
        }),
      ],
      'duplicate active coverage': [
        representationItem({
          name: 'Parmesan',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
          coverage: ['parmesan'],
        }),
        representationItem({
          name: 'grated Parmesan',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
          coverage: ['parmesan'],
        }),
      ],
      'composite covering active components': [
        representationItem({
          name: 'pasta',
          groupKey: 'dish',
          mode: 'composite',
          kind: 'composite',
          coverage: ['pasta', 'sauce'],
        }),
        representationItem({
          name: 'sauce',
          groupKey: 'dish',
          mode: 'composite',
          kind: 'composite',
          active: false,
          coverage: ['sauce'],
        }),
        representationItem({
          name: 'pasta',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
          active: true,
          coverage: ['pasta'],
        }),
        representationItem({
          name: 'sauce',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
          active: true,
          coverage: ['sauce'],
        }),
      ],
      'unknown exclusion': [
        representationItem({
          name: 'pasta',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
        }),
        representationItem({
          name: 'sauce',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
        }),
        representationItem({
          name: 'pasta with sauce',
          groupKey: 'dish',
          mode: 'composite',
          kind: 'composite',
          active: true,
          coverage: ['pasta', 'sauce'],
          excludedCoverage: ['parmesan'],
        }),
      ],
      'decomposed representation with one component': [
        representationItem({
          name: 'pasta',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
        }),
      ],
      'multiple inactive alternatives': [
        representationItem({
          name: 'pasta',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
        }),
        representationItem({
          name: 'pasta with sauce',
          groupKey: 'dish',
          mode: 'composite',
          kind: 'composite',
          active: false,
        }),
        representationItem({
          name: 'pasta meal',
          groupKey: 'dish',
          mode: 'composite',
          kind: 'composite',
          active: false,
        }),
      ],
      'generic coverage': [
        representationItem({
          name: 'food',
          groupKey: 'dish',
          mode: 'composite',
          kind: 'composite',
          coverage: ['food'],
        }),
      ],
    };

    expect(() => adaptRepresentationItems(cases[caseName]!)).toThrow();
  });

  it('marks identical coverage without spatial evidence as uncertain', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'egg',
        groupKey: 'egg-a',
        mode: 'composite',
        kind: 'composite',
        coverage: ['egg'],
      }),
      representationItem({
        name: 'egg',
        groupKey: 'egg-b',
        mode: 'composite',
        kind: 'composite',
        coverage: ['egg'],
      }),
    ]);

    expect(adapted.active).toHaveLength(2);
    expect(adapted.groups.map((group) => group.overlapStatus)).toEqual([
      'uncertain',
      'uncertain',
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:representation]',
      expect.objectContaining({
        category: 'potential_cross_group_overlap',
      }),
    );
    expect(JSON.stringify(warn.mock.calls.at(-1)?.[1])).not.toContain('egg');
    warn.mockRestore();
  });

  it('allows identical coverage when one region is unavailable and marks it uncertain', () => {
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'bread slice',
        groupKey: 'slice-a',
        mode: 'composite',
        kind: 'composite',
        region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        coverage: ['bread slice'],
      }),
      representationItem({
        name: 'bread slice',
        groupKey: 'slice-b',
        mode: 'composite',
        kind: 'composite',
        coverage: ['bread slice'],
      }),
    ]);

    expect(adapted.active).toHaveLength(2);
    expect(
      adapted.groups.every((group) => group.overlapStatus === 'uncertain'),
    ).toBe(true);
  });

  it('allows identical coverage for separate regions and rejects substantial overlap', () => {
    const separate = adaptRepresentationItems([
      representationItem({
        name: 'egg',
        groupKey: 'egg-a',
        mode: 'composite',
        kind: 'composite',
        region: { x: 0, y: 0, width: 0.2, height: 0.2 },
        coverage: ['egg'],
      }),
      representationItem({
        name: 'egg',
        groupKey: 'egg-b',
        mode: 'composite',
        kind: 'composite',
        region: { x: 0.7, y: 0.7, width: 0.2, height: 0.2 },
        coverage: ['egg'],
      }),
    ]);
    expect(separate.active).toHaveLength(2);
    expect(
      separate.groups.every(
        (group) => group.overlapStatus === 'non_overlapping',
      ),
    ).toBe(true);

    expect(() =>
      adaptRepresentationItems([
        representationItem({
          name: 'egg',
          groupKey: 'egg-a',
          mode: 'composite',
          kind: 'composite',
          region: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
          coverage: ['egg'],
        }),
        representationItem({
          name: 'egg',
          groupKey: 'egg-b',
          mode: 'composite',
          kind: 'composite',
          region: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
          coverage: ['egg'],
        }),
      ]),
    ).toThrow();
  });

  it.each([
    {
      name: 'edge-touching regions',
      first: { x: 0, y: 0, width: 0.2, height: 0.2 },
      second: { x: 0.2, y: 0, width: 0.2, height: 0.2 },
      expected: 'non_overlapping',
    },
    {
      name: 'below-threshold intersection',
      first: { x: 0, y: 0, width: 0.4, height: 0.4 },
      second: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      expected: 'non_overlapping',
    },
    {
      name: 'above-threshold intersection',
      first: { x: 0, y: 0, width: 0.5, height: 0.5 },
      second: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 },
      expected: 'reject',
    },
    {
      name: 'contained region',
      first: { x: 0, y: 0, width: 0.8, height: 0.8 },
      second: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 },
      expected: 'reject',
    },
  ])('handles $name deterministically', ({ first, second, expected }) => {
    const items = [
      representationItem({
        name: 'rice',
        groupKey: 'rice-a',
        mode: 'composite',
        kind: 'composite',
        region: first,
        coverage: ['rice'],
      }),
      representationItem({
        name: 'rice',
        groupKey: 'rice-b',
        mode: 'composite',
        kind: 'composite',
        region: second,
        coverage: ['rice'],
      }),
    ];

    if (expected === 'reject') {
      expect(() => adaptRepresentationItems(items)).toThrow();
      return;
    }

    const adapted = adaptRepresentationItems(items);
    expect(
      adapted.groups.every((group) => group.overlapStatus === expected),
    ).toBe(true);
  });

  it('rejects a cross-group composite/component duplicate without an exclusion', () => {
    expect(() =>
      adaptRepresentationItems([
        representationItem({
          name: 'pasta',
          groupKey: 'component-group',
          mode: 'decomposed',
          kind: 'component',
          coverage: ['pasta'],
        }),
        representationItem({
          name: 'pasta with sauce',
          groupKey: 'composite-group',
          mode: 'composite',
          kind: 'composite',
          coverage: ['pasta'],
        }),
      ]),
    ).toThrow();
  });

  it('keeps same-named rows with distinct coverage uncertain rather than merging them', () => {
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'chicken',
        groupKey: 'chicken-a',
        mode: 'composite',
        kind: 'composite',
        coverage: ['chicken breast'],
      }),
      representationItem({
        name: 'chicken',
        groupKey: 'chicken-b',
        mode: 'composite',
        kind: 'composite',
        coverage: ['chicken thigh'],
      }),
    ]);

    expect(adapted.active).toHaveLength(2);
    expect(
      adapted.groups.every(
        (group) => group.overlapStatus === 'non_overlapping',
      ),
    ).toBe(true);
  });

  it('emits safe representation diagnostics without provider food names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() =>
      adaptRepresentationItems([
        representationItem({
          name: 'grated Parmesan',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
          coverage: ['parmesan'],
        }),
        representationItem({
          name: 'Parmesan cheese',
          groupKey: 'dish',
          mode: 'decomposed',
          kind: 'component',
          coverage: ['parmesan'],
        }),
      ]),
    ).toThrow();

    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:representation]',
      expect.objectContaining({
        category: 'duplicate_active_coverage',
        groupIndex: 0,
      }),
    );
    const diagnostic = warn.mock.calls.at(-1)?.[1];
    expect(JSON.stringify(diagnostic)).not.toContain('Parmesan');
  });

  it.each([
    'item',
    'food',
    'serving',
    'meal',
    'pasta',
    'sauce',
    'Parmesan',
    'grated Parmesan',
  ])('rejects generic or non-countable count label %s', (countLabel) => {
    expect(() =>
      parseProviderOutput(
        JSON.stringify({
          items: [
            {
              name: 'food',
              preparationForm: null,
              identityConfidence: 'medium',
              region: null,
              quantityState: 'estimated',
              quantityAmount: 1,
              quantityUnit: 'count',
              quantityCountLabel: countLabel,
              quantityRawText: `1 ${countLabel}`,
              quantityConfidence: 'medium',
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it('preserves rows and marks overlap uncertain after invalid regions are discarded', () => {
    const first = representationItem({
      name: 'Parmesan',
      groupKey: 'topping-a',
      mode: 'composite',
      kind: 'composite',
      region: { x: 1.2, y: 0, width: 0.2, height: 0.2 },
      coverage: ['parmesan'],
    });
    const second = representationItem({
      name: 'grated Parmesan',
      groupKey: 'topping-b',
      mode: 'composite',
      kind: 'composite',
      region: { x: 1.1, y: 0, width: 0.2, height: 0.2 },
      coverage: ['parmesan'],
    });

    const adapted = adaptRepresentationItems([first, second]);
    expect(adapted.active).toHaveLength(2);
    expect(
      adapted.groups.every((group) => group.overlapStatus === 'uncertain'),
    ).toBe(true);
  });

  it.each([
    {
      quantityState: 'estimated',
      quantityAmount: 0,
      quantityUnit: 'gram',
      quantityCountLabel: null,
      quantityRawText: '0 grams',
      quantityConfidence: 'low',
    },
    {
      quantityState: 'estimated',
      quantityAmount: 1,
      quantityUnit: 'count',
      quantityCountLabel: null,
      quantityRawText: '1 count',
      quantityConfidence: 'low',
    },
    {
      quantityState: 'estimated',
      quantityAmount: 1,
      quantityUnit: 'gram',
      quantityCountLabel: 'egg',
      quantityRawText: '1 gram egg',
      quantityConfidence: 'low',
    },
    {
      quantityState: 'estimated',
      quantityAmount: 'half',
      quantityUnit: 'piece',
      quantityCountLabel: null,
      quantityRawText: 'half a piece',
      quantityConfidence: 'low',
    },
    {
      quantityState: 'estimated',
      quantityAmount: 1,
      quantityUnit: 'serving',
      quantityCountLabel: null,
      quantityRawText: '1 serving',
      quantityConfidence: 'low',
    },
    {
      quantityState: 'no_responsible_estimate',
      quantityAmount: 1,
      quantityUnit: null,
      quantityCountLabel: null,
      quantityRawText: null,
      quantityConfidence: null,
    },
    {
      quantityState: 'no_responsible_estimate',
      quantityAmount: null,
      quantityUnit: null,
      quantityCountLabel: null,
      quantityRawText: null,
      quantityConfidence: 'low',
    },
  ])('rejects contradictory structured quantity output %#', (quantity) => {
    expect(() =>
      parseProviderOutput(
        JSON.stringify({
          items: [
            {
              name: 'food',
              preparationForm: null,
              identityConfidence: 'medium',
              region: null,
              ...quantity,
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it('rejects unsupported content types before invoking the provider', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'application/octet-stream')
      .send(jpeg)
      .expect(415);

    expectErrorEnvelope(response.body, 'UNSUPPORTED_IMAGE_TYPE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing content type before invoking the provider', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .send(jpeg)
      .expect(415);

    expectErrorEnvelope(response.body, 'UNSUPPORTED_IMAGE_TYPE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty or invalid JPEG before invoking the provider', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(Buffer.from([0x00, 0x01, 0x02]))
      .expect(400);

    expectErrorEnvelope(response.body, 'INVALID_IMAGE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects one byte over the exact five MiB upload limit', async () => {
    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(Buffer.concat([jpeg, Buffer.alloc(PHOTO_ANALYSIS_MAX_BYTES)]))
      .expect(413);

    expectErrorEnvelope(response.body, 'IMAGE_TOO_LARGE');
  });

  it('accepts the exact five MiB boundary before provider processing', async () => {
    process.env.AI_PROVIDER = 'disabled';

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(
        Buffer.concat([
          jpeg,
          Buffer.alloc(PHOTO_ANALYSIS_MAX_BYTES - jpeg.length),
        ]),
      )
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
  });

  it('returns independent review rows without writing FoodItems or FoodLogs', async () => {
    const before = {
      foodItems: await prisma.foodItem.count(),
      foodLogs: await prisma.foodLog.count(),
    };

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data).toMatchObject({
      status: 'recognized',
      items: [
        expect.objectContaining({
          id: 'photo-item-1',
          recognizedName: expect.any(String),
          candidates: expect.any(Array),
          selectedCandidateId: null,
          loggable: false,
          portionConfidence: null,
        }),
      ],
    });
    expect(response.body.data.items[0].provisionalPortion).toMatchObject({
      confidence: null,
      quantity: { state: 'no_responsible_estimate' },
    });
    expect(response.body.data.items[0].provisionalPortion.parsed.status).toBe(
      'missing',
    );
    expect(response.body.data.items[0]).not.toHaveProperty('nutrition');
    expect(response.body.data.items[0]).not.toHaveProperty('providerPayload');
    expect(await prisma.foodItem.count()).toBe(before.foodItems);
    expect(await prisma.foodLog.count()).toBe(before.foodLogs);
  });

  it('discards invalid optional regions while preserving retrieval and quantity', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');
    const before = {
      foodItems: await prisma.foodItem.count(),
      foodLogs: await prisma.foodLog.count(),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              region: {
                                x: 0.9,
                                y: 0.1,
                                width: 0.3,
                                height: 0.2,
                              },
                              ...estimatedQuantity(
                                150,
                                'gram',
                                '150 grams',
                                'medium',
                              ),
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      recognizedName: 'chicken',
      identityConfidence: 'high',
      region: null,
      selectedCandidateId: expect.any(String),
      provisionalPortion: {
        quantity: {
          state: 'estimated',
          amount: 150,
          unit: 'gram',
          confidence: 'medium',
        },
      },
    });
    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:provider]',
      expect.objectContaining({
        category: 'provider_optional_region_discarded',
        itemIndex: 0,
      }),
    );
    const diagnostic = warn.mock.calls.find(
      ([, details]) =>
        (details as { category?: string }).category ===
        'provider_optional_region_discarded',
    )?.[1];
    expect(JSON.stringify(diagnostic)).not.toContain('0.9');
    expect(JSON.stringify(diagnostic)).not.toContain('0.3');
    expect(await prisma.foodItem.count()).toBe(before.foodItems);
    expect(await prisma.foodLog.count()).toBe(before.foodLogs);
  });

  it('sends only the normalized JPEG to Gemini and rejects nutrition-bearing output', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    let captured: { body: Record<string, unknown>; headers: Headers } | null =
      null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        captured = {
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
          headers: new Headers(init?.headers),
        };
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        items: [
                          {
                            name: 'chicken',
                            identityConfidence: 'high',
                            ...estimatedQuantity(
                              150,
                              'gram',
                              '150 g',
                              'medium',
                            ),
                            calories: 300,
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
    expect(captured).not.toBeNull();
    const capturedRequest = captured as unknown as {
      body: Record<string, unknown>;
      headers: Headers;
    };
    expect(capturedRequest.headers.get('x-goog-api-key')).toBe('test-key');
    const contents = capturedRequest.body.contents as {
      parts: Record<string, unknown>[];
    }[];
    expect(contents[0]?.parts[0]).toMatchObject({
      inlineData: {
        mimeType: 'image/jpeg',
        data: jpeg.toString('base64'),
      },
    });
    const inlineData = contents[0]?.parts[0]?.inlineData as {
      data?: string;
    };
    expect(inlineData.data).not.toContain('data:image/jpeg;base64,');
    expect(Buffer.from(inlineData.data ?? '', 'base64')).toEqual(jpeg);
    const generationConfig = capturedRequest.body.generationConfig as {
      responseMimeType?: string;
      responseSchema?: Record<string, unknown>;
    };
    expect(generationConfig.responseMimeType).toBe('application/json');
    expect(JSON.stringify(generationConfig.responseSchema)).not.toContain(
      'additionalProperties',
    );
    const schemaText = JSON.stringify(generationConfig.responseSchema);
    expect(schemaText).not.toContain('activeItemIds');
    expect(schemaText).not.toContain('overlapStatus');
    expect(schemaText).not.toContain('loggable');
    expect(schemaText).not.toContain('calories');
    expect(schemaText).not.toContain('foodItemId');
    const responseSchema = generationConfig.responseSchema as {
      properties?: {
        items?: {
          maxItems?: number;
          items?: {
            properties?: Record<string, unknown>;
          };
        };
      };
    };
    expect(responseSchema.properties?.items).not.toHaveProperty('maxItems');
    const quantityProperties =
      responseSchema.properties?.items?.items?.properties ?? {};
    expect(quantityProperties).toHaveProperty('quantityState');
    expect(quantityProperties).toHaveProperty('quantityAmount');
    expect(quantityProperties).toHaveProperty('quantityUnit');
    expect(quantityProperties).toHaveProperty('quantityCountLabel');
    expect(quantityProperties).toHaveProperty('quantityRawText');
    expect(quantityProperties).toHaveProperty('quantityConfidence');
    expect(quantityProperties).toHaveProperty('groupKey');
    expect(quantityProperties).toHaveProperty('representationMode');
    expect(quantityProperties).toHaveProperty('representationKind');
    expect(quantityProperties).toHaveProperty('active');
    expect(quantityProperties).toHaveProperty('coverage');
    expect(quantityProperties).toHaveProperty('excludedCoverage');
    expect(quantityProperties).toHaveProperty('representationConfidence');
    expect(contents[0]?.parts[1]?.text).toEqual(
      expect.stringContaining('calories'),
    );
  });

  it('keeps a valid active group when an optional alternative is invalid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'pasta',
        groupKey: 'dish',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['pasta'],
      }),
      representationItem({
        name: 'tomato sauce',
        groupKey: 'dish',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['tomato sauce'],
      }),
      representationItem({
        name: 'pasta meal alternative',
        groupKey: 'dish',
        mode: 'composite',
        kind: 'composite',
        active: false,
        coverage: ['pasta'],
        excludedCoverage: ['missing coverage'],
      }),
    ]);

    expect(adapted.active).toHaveLength(2);
    expect(adapted.groups[0]?.alternatives).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:representation]',
      expect.objectContaining({
        category: 'provider_optional_alternative_discarded',
      }),
    );
    warn.mockRestore();
  });

  it('drops invalid optional visible metadata while preserving the active group', () => {
    const parsed = parseProviderOutput(
      JSON.stringify({
        items: [
          {
            ...representationItem({
              name: 'pasta',
              groupKey: 'dish',
              mode: 'composite',
              kind: 'composite',
            }),
            visiblePortionDescription: 42,
          },
        ],
      }),
    );

    expect(parsed[0]?.representation.visiblePortionDescription).toBe(42);
    const adapted = adaptPhotoRepresentations(parsed);
    expect(adapted.active).toHaveLength(1);
    expect(adapted.active[0]?.visiblePortionDescription).toBeNull();
  });

  it('discards an alternative with a malformed optional region', () => {
    const parsed = parseProviderOutput(
      JSON.stringify({
        items: [
          representationItem({
            name: 'pasta',
            groupKey: 'dish',
            mode: 'decomposed',
            kind: 'component',
            coverage: ['pasta'],
          }),
          representationItem({
            name: 'sauce',
            groupKey: 'dish',
            mode: 'decomposed',
            kind: 'component',
            coverage: ['sauce'],
          }),
          {
            ...representationItem({
              name: 'pasta with sauce',
              groupKey: 'dish',
              mode: 'composite',
              kind: 'composite',
              active: false,
              coverage: ['pasta', 'sauce'],
            }),
            region: { x: 1.2, y: 0, width: 0.2, height: 0.2 },
          },
        ],
      }),
    );

    const adapted = adaptPhotoRepresentations(parsed);
    expect(adapted.active).toHaveLength(2);
    expect(adapted.groups[0]?.alternatives).toEqual([]);
  });

  it('discards an independently invalid group while preserving valid groups', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const adapted = adaptRepresentationItems([
      representationItem({
        name: 'egg',
        groupKey: 'valid-group',
        mode: 'composite',
        kind: 'composite',
        coverage: ['egg'],
      }),
      representationItem({
        name: 'rice',
        groupKey: 'invalid-group',
        mode: 'decomposed',
        kind: 'component',
        coverage: ['rice'],
      }),
    ]);

    expect(adapted.groups).toHaveLength(1);
    expect(adapted.active).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:representation]',
      expect.objectContaining({
        category: 'provider_representation_group_discarded',
      }),
    );
    warn.mockRestore();
  });

  it('rejects an invalid group when its coverage overlaps a valid group', () => {
    expect(() =>
      adaptRepresentationItems([
        representationItem({
          name: 'egg',
          groupKey: 'valid-group',
          mode: 'composite',
          kind: 'composite',
          coverage: ['egg'],
        }),
        representationItem({
          name: 'egg duplicate',
          groupKey: 'invalid-group',
          mode: 'decomposed',
          kind: 'component',
          coverage: ['egg'],
        }),
      ]),
    ).toThrow();
  });

  it('rejects when every representation group is invalid', () => {
    expect(() =>
      adaptRepresentationItems([
        representationItem({
          name: 'rice',
          groupKey: 'invalid-a',
          mode: 'decomposed',
          kind: 'component',
          coverage: ['rice'],
        }),
        representationItem({
          name: 'pasta',
          groupKey: 'invalid-b',
          mode: 'decomposed',
          kind: 'component',
          coverage: ['pasta'],
        }),
      ]),
    ).toThrow();
  });

  it('records a sanitized Gemini invalid-request diagnostic exactly once', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: 400,
                status: 'INVALID_ARGUMENT',
                message:
                  'Invalid JSON payload received. Unknown name "inline_data".',
                details: [
                  {
                    fieldViolations: [
                      { field: 'contents[0].parts[0].inline_data' },
                    ],
                  },
                ],
              },
            }),
            { status: 400, statusText: 'Bad Request' },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:provider]',
      expect.objectContaining({
        category: 'non_ok_response',
        status: 400,
        providerCode: 400,
        providerStatus: 'INVALID_ARGUMENT',
        providerMessage: expect.stringContaining('Unknown name'),
        fieldViolationPaths: ['contents[0].parts[0].inline_data'],
      }),
    );
  });

  it('rejects invalid provisional quantities and unknown provider fields', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              ...estimatedQuantity(-1, 'gram', '-1 g', 'high'),
                              unknown: true,
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
  });

  it('rejects more than eight provider recognition rows', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: Array.from({ length: 9 }, (_, index) => ({
                            name: `food ${index + 1}`,
                            identityConfidence: 'low',
                            ...noResponsibleEstimate,
                          })),
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
  });

  it('returns no_food_detected without writing when the provider finds nothing', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: { parts: [{ text: JSON.stringify({ items: [] }) }] },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data).toEqual({
      status: 'no_food_detected',
      items: [],
      representationGroups: [],
    });
    expect(await prisma.foodItem.count()).toBe(0);
    expect(await prisma.foodLog.count()).toBe(0);
  });

  it('keeps low identity confidence unresolved even when a trusted candidate exists', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'low',
                              ...estimatedQuantity(
                                150,
                                'gram',
                                '150 g',
                                'medium',
                              ),
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      identityConfidence: 'low',
      selectedCandidateId: null,
      loggable: false,
      unresolvedReason: 'low_identity_confidence',
    });
  });

  it('marks an unsupported visual household portion as needs_review', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              ...estimatedQuantity(1, 'cup', '1 cup', 'low'),
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.items[0]).toMatchObject({
      selectedCandidateId: expect.any(String),
      loggable: false,
      unresolvedReason: 'portion_needs_review',
      provisionalPortion: { servingResolution: 'needs_review' },
    });
  });

  it('returns multiple independently ranked foods with a supported provisional serving', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');
    await createTrustedFood('rice');

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              ...estimatedQuantity(
                                150,
                                'gram',
                                '150 g',
                                'medium',
                              ),
                            },
                            {
                              name: 'rice',
                              identityConfidence: 'medium',
                              ...estimatedQuantity(150, 'gram', '150 g', 'low'),
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.status).toBe('recognized');
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.items[0]).toMatchObject({
      id: 'photo-item-1',
      recognizedName: 'chicken',
      selectedCandidateId: expect.any(String),
      loggable: true,
      provisionalPortion: {
        servingResolution: 'supported',
        parsed: { status: 'parsed', quantity: 150, unit: 'g' },
      },
    });
    expect(response.body.data.items[1]).toMatchObject({
      id: 'photo-item-2',
      recognizedName: 'rice',
      provisionalPortion: { servingResolution: 'needs_review' },
    });
    expect(response.body.data.items[0]).not.toHaveProperty('calories');
    expect(response.body.data.items[0].candidates[0]).toHaveProperty(
      'confidence',
    );
  });

  it('retrieves only active representation rows and retains inactive alternatives', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('pasta');
    await createTrustedFood('tomato sauce');
    await createTrustedFood('pasta with tomato sauce');

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            representationItem({
                              name: 'pasta',
                              groupKey: 'dish',
                              mode: 'decomposed',
                              kind: 'component',
                              coverage: ['pasta'],
                            }),
                            representationItem({
                              name: 'tomato sauce',
                              groupKey: 'dish',
                              mode: 'decomposed',
                              kind: 'component',
                              coverage: ['tomato sauce'],
                            }),
                            representationItem({
                              name: 'pasta with tomato sauce',
                              groupKey: 'dish',
                              mode: 'composite',
                              kind: 'composite',
                              active: false,
                              coverage: ['pasta', 'tomato sauce'],
                            }),
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.items).toHaveLength(2);
    expect(
      response.body.data.items.map(
        (item: { recognizedName: string }) => item.recognizedName,
      ),
    ).toEqual(['pasta', 'tomato sauce']);
    expect(
      response.body.data.items.every(
        (item: { active: boolean }) => item.active,
      ),
    ).toBe(true);
    expect(response.body.data.representationGroups[0]).toMatchObject({
      activeRepresentation: 'decomposed',
      activeItemIds: ['photo-item-1', 'photo-item-2'],
      alternatives: [
        {
          active: false,
          representation: 'composite',
          items: [
            expect.objectContaining({
              recognizedName: 'pasta with tomato sauce',
              active: false,
            }),
          ],
        },
      ],
    });
  });

  it('keeps returned trusted candidate references compatible with authoritative saving', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              ...estimatedQuantity(
                                150,
                                'gram',
                                '150 g',
                                'medium',
                              ),
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const analysis = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);
    const foodItemId = analysis.body.data.items[0]
      .selectedCandidateId as string;

    const save = await api
      .post('/api/v1/food-logs/from-candidates')
      .send({
        mealType: 'lunch',
        loggedAt: new Date().toISOString(),
        items: [
          {
            candidateType: 'food_item',
            foodItemId,
            serving: { quantity: 150, unit: 'g' },
          },
        ],
      })
      .expect(200);

    expect(save.body.data.foodLogs).toHaveLength(1);
    expect(save.body.data.foodLogs[0]).toMatchObject({
      foodItemId,
      calories: 248,
    });
    expect(await prisma.foodLog.count()).toBe(1);
  });

  it('keeps duplicate recognition rows unresolved instead of auto-selecting both', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    await createTrustedFood('chicken');

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          items: [
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              ...estimatedQuantity(
                                150,
                                'gram',
                                '150 g',
                                'medium',
                              ),
                            },
                            {
                              name: 'chicken',
                              identityConfidence: 'high',
                              ...estimatedQuantity(
                                150,
                                'gram',
                                '150 g',
                                'medium',
                              ),
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.items[0].loggable).toBe(true);
    expect(response.body.data.items[1]).toMatchObject({
      selectedCandidateId: null,
      loggable: false,
      unresolvedReason: 'ambiguous_identity',
    });
  });

  it('assembles multiple final text parts in order before strict parsing', () => {
    const part1 = '{"items":[{"name":"grilled chick';
    const part2 =
      'en","preparationForm":null,"identityConfidence":"high","quantityState":"no_responsible_estimate","quantityAmount":null,"quantityUnit":null,"quantityCountLabel":null,"quantityRawText":null,"quantityConfidence":null,"region":null}]}';

    expect(() => parseProviderOutput(`${part1}${part2}`)).not.toThrow();
  });

  it.each([
    ['MAX_TOKENS', 'provider_output_truncated'],
    ['MALFORMED_RESPONSE', 'provider_completion_error'],
    ['SAFETY', 'provider_completion_error'],
    ['RECITATION', 'provider_completion_error'],
    ['OTHER', 'provider_completion_error'],
  ] as const)(
    'rejects %s before parsing candidate text',
    async (finishReason, category) => {
      process.env.AI_PROVIDER = 'gemini';
      process.env.GEMINI_API_KEY = 'test-key';
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const parseSpy = vi.spyOn(JSON, 'parse');
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                candidates: [
                  {
                    finishReason,
                    finishMessage: 'safe provider detail',
                    content: { parts: [{ text: '{"items":[' }] },
                  },
                ],
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 768,
                  thoughtsTokenCount: 20,
                  totalTokenCount: 798,
                },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
        ),
      );

      const response = await api
        .post('/api/v1/ai/photo-analysis')
        .set('Content-Type', 'image/jpeg')
        .send(jpeg)
        .expect(503);

      expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
      expect(parseSpy).toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        '[photo-analysis:provider]',
        expect.objectContaining({ category }),
      );
      const diagnostic = warn.mock.calls.at(-1)?.[1] as Record<string, unknown>;
      expect(JSON.stringify(diagnostic)).not.toContain('{"items":[');
      expect(diagnostic.finishMessage).toBe('safe provider detail');
    },
  );

  it('rejects a missing finish reason before parsing candidate text', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:provider]',
      expect.objectContaining({
        category: 'provider_incomplete_response',
        finishReason: undefined,
      }),
    );
  });

  it('uses only the selected candidate and excludes thought parts', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [
                      { text: 'internal thought', thought: true },
                      {
                        text: '{"items":[{"name":"grilled chick',
                      },
                      {
                        text: 'en","preparationForm":null,"identityConfidence":"high","quantityState":"no_responsible_estimate","quantityAmount":null,"quantityUnit":null,"quantityCountLabel":null,"quantityRawText":null,"quantityConfidence":null,"region":null}]}',
                      },
                    ],
                  },
                },
                {
                  finishReason: 'STOP',
                  content: { parts: [{ text: '{"items":[]}' }] },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    expect(response.body.data.status).toBe('recognized');
    expect(response.body.data.items[0].recognizedName).toBe('grilled chicken');
  });

  it('classifies STOP with malformed JSON separately from truncation', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  finishReason: 'STOP',
                  content: {
                    parts: [{ text: '{"items":[{"name":"chicken"}' }],
                  },
                },
              ],
              usageMetadata: {
                promptTokenCount: 20,
                candidatesTokenCount: 80,
                thoughtsTokenCount: 0,
                totalTokenCount: 100,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    const response = await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(503);

    expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
    expect(warn).toHaveBeenCalledWith(
      '[photo-analysis:provider]',
      expect.objectContaining({
        category: 'provider_malformed_completed_json',
        finishReason: 'STOP',
        promptTokenCount: 20,
        candidatesTokenCount: 80,
        thoughtsTokenCount: 0,
        totalTokenCount: 100,
      }),
    );
    expect(warn.mock.calls.map((call) => JSON.stringify(call[1]))).not.toEqual(
      expect.arrayContaining([expect.stringContaining('chicken')]),
    );
  });

  it('rejects unsupported parts and empty completed output', async () => {
    for (const parts of [[{ functionCall: { name: 'bad' } }], []]) {
      process.env.AI_PROVIDER = 'gemini';
      process.env.GEMINI_API_KEY = 'test-key';
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                candidates: [{ finishReason: 'STOP', content: { parts } }],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
        ),
      );

      const response = await api
        .post('/api/v1/ai/photo-analysis')
        .set('Content-Type', 'image/jpeg')
        .send(jpeg)
        .expect(503);
      expectErrorEnvelope(response.body, 'AI_UNAVAILABLE');
      vi.unstubAllGlobals();
    }
  });

  it('sends a bounded photo-specific output budget with one candidate and no stop sequence', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.PHOTO_ANALYSIS_MAX_OUTPUT_TOKENS = '2048';
    let body: Record<string, unknown> | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: '{"items":[]}' }] },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }),
    );

    await api
      .post('/api/v1/ai/photo-analysis')
      .set('Content-Type', 'image/jpeg')
      .send(jpeg)
      .expect(200);

    const generationConfig = body?.generationConfig as Record<string, unknown>;
    expect(generationConfig.maxOutputTokens).toBe(2048);
    expect(generationConfig.candidateCount).toBe(1);
    expect(generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(generationConfig).not.toHaveProperty('stopSequences');
    expect(photoAnalysisConfig().maxOutputTokens).toBe(2048);
  });

  it('rejects an invalid photo output budget environment value', () => {
    process.env.PHOTO_ANALYSIS_MAX_OUTPUT_TOKENS = 'not-a-number';
    expect(() => photoAnalysisConfig()).toThrow(
      /PHOTO_ANALYSIS_MAX_OUTPUT_TOKENS/,
    );
  });
});
