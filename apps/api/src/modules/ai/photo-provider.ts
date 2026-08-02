import {
  MAX_SERVING_QUANTITY,
  parseServingText,
  photoNormalizedRegionSchema,
  photoConfidenceLevelSchema,
  photoProvisionalQuantitySchema,
  PHOTO_ANALYSIS_MAX_COVERAGE_LABELS,
  PHOTO_ANALYSIS_MAX_PROVIDER_ITEMS,
  PHOTO_REPRESENTATION_KINDS,
  PHOTO_REPRESENTATION_MODES,
  PHOTO_QUANTITY_STATES,
  PHOTO_QUANTITY_UNITS,
  type PhotoQuantityState,
  type PhotoQuantityUnit,
  type PhotoConfidenceLevel,
  type PhotoRepresentationKind,
  type PhotoRepresentationMode,
  type ParsedServingSuggestion,
} from '@food-tracker/shared';
import { z } from 'zod';
import { emitServerDiagnostic } from '../../lib/diagnostics.js';
import { AppError } from '../../lib/errors.js';
import type { PhotoAnalysisConfig } from './photo-config.js';
import { photoAnalysisDiagnosticDetails } from './photo-diagnostics.js';

export interface ProviderPhotoSuggestion {
  name: string;
  preparationForm: string | null;
  quantity: ProviderPhotoQuantity;
  identityConfidence: PhotoConfidenceLevel;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  regionWasDiscarded: boolean;
  representation: ProviderPhotoRepresentation;
}

export interface ProviderPhotoRepresentation {
  groupKey: string | null;
  representationMode: PhotoRepresentationMode | null;
  representationKind: PhotoRepresentationKind | null;
  active: boolean;
  coverage: string[];
  excludedCoverage: string[];
  representationConfidence: PhotoConfidenceLevel | null;
  visiblePortionDescription: unknown;
}

export type ProviderPhotoQuantity =
  | {
      quantityState: 'estimated';
      quantityAmount: number;
      quantityUnit: PhotoQuantityUnit;
      quantityCountLabel: string | null;
      quantityRawText: string;
      quantityConfidence: PhotoConfidenceLevel;
      massEstimateGrams?: number | null | undefined;
      massEstimateConfidence?: PhotoConfidenceLevel | null | undefined;
    }
  | {
      quantityState: 'no_responsible_estimate';
      quantityAmount: null;
      quantityUnit: null;
      quantityCountLabel: null;
      quantityRawText: null;
      quantityConfidence: null;
      massEstimateGrams?: number | null | undefined;
      massEstimateConfidence?: PhotoConfidenceLevel | null | undefined;
    };

export interface PhotoAnalysisProvider {
  analyze(input: {
    image: Uint8Array;
    mimeType: 'image/jpeg';
    signal: AbortSignal;
  }): Promise<ProviderPhotoSuggestion[]>;
}

const providerSuggestionSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  preparationForm: z.string().trim().min(1).max(80).nullable().default(null),
  identityConfidence: photoConfidenceLevelSchema,
  quantityState: z.enum(PHOTO_QUANTITY_STATES),
  quantityAmount: z
    .number()
    .finite()
    .positive()
    .max(MAX_SERVING_QUANTITY)
    .nullable(),
  quantityUnit: z.enum(PHOTO_QUANTITY_UNITS).nullable(),
  quantityCountLabel: z.string().trim().min(1).max(40).nullable(),
  quantityRawText: z.string().trim().min(1).max(120).nullable(),
  quantityConfidence: photoConfidenceLevelSchema.nullable(),
  massEstimateGrams: z
    .number()
    .finite()
    .positive()
    .max(MAX_SERVING_QUANTITY)
    .nullable()
    .default(null),
  massEstimateConfidence: photoConfidenceLevelSchema.nullable().default(null),
  // Region is optional provider metadata. It is validated separately so an
  // invalid box cannot invalidate otherwise valid identity and quantity data.
  region: z.unknown().nullable().default(null),
  groupKey: z.string().trim().min(1).max(40).nullable().default(null),
  representationMode: z
    .enum(PHOTO_REPRESENTATION_MODES)
    .nullable()
    .default(null),
  representationKind: z
    .enum(PHOTO_REPRESENTATION_KINDS)
    .nullable()
    .default(null),
  active: z.boolean().default(true),
  coverage: z
    .array(z.string().trim().min(1).max(80))
    .max(PHOTO_ANALYSIS_MAX_COVERAGE_LABELS)
    .default([]),
  excludedCoverage: z
    .array(z.string().trim().min(1).max(80))
    .max(PHOTO_ANALYSIS_MAX_COVERAGE_LABELS)
    .default([]),
  representationConfidence: photoConfidenceLevelSchema.nullable().default(null),
  // Optional metadata is isolated by the deterministic adapter.
  visiblePortionDescription: z.unknown().nullable().default(null),
});

const providerOutputSchema = z.strictObject({
  items: z
    .array(providerSuggestionSchema)
    .max(PHOTO_ANALYSIS_MAX_PROVIDER_ITEMS),
});

const geminiResponseSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          preparationForm: { type: 'string', nullable: true },
          identityConfidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          quantityState: {
            type: 'string',
            enum: [...PHOTO_QUANTITY_STATES],
            description:
              'Make one quantity decision for every active visible food component. Use estimated when a rounded approximate quantity is responsibly supportable; use no_responsible_estimate only after considering every supported unit.',
          },
          quantityAmount: {
            type: 'number',
            nullable: true,
            description:
              'Positive rounded approximate visible amount; avoid false precision and do not use a provider default.',
          },
          quantityUnit: {
            type: 'string',
            enum: [...PHOTO_QUANTITY_UNITS],
            nullable: true,
            description:
              'Prefer a familiar observable household unit such as tablespoon, teaspoon, cup, piece, slice, count, gram, ounce, millilitre, or a supported count label.',
          },
          quantityCountLabel: {
            type: 'string',
            nullable: true,
          },
          quantityRawText: {
            type: 'string',
            nullable: true,
            description:
              'Short approximate wording that describes the visible amount without false precision.',
          },
          quantityConfidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            nullable: true,
            description:
              'Confidence in the visual quantity estimate. Preserve low confidence as an estimate for user review.',
          },
          massEstimateGrams: {
            type: 'number',
            nullable: true,
            description:
              'Optional rounded approximate mass in grams for this same visible component. Use only when the visible amount and identity support it; never copy a provider default or use 100 g as a default.',
          },
          massEstimateConfidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            nullable: true,
            description:
              'Confidence in the optional photo-derived gram estimate. Omit when a responsible mass estimate is not possible.',
          },
          region: {
            type: 'object',
            nullable: true,
            description:
              'Optional normalized image bounds. x and y are top-left coordinates; width and height are dimensions. Every value is a decimal from 0.0 through 1.0, x + width <= 1.0, and y + height <= 1.0. Omit or return null when uncertain. Never use percentages, pixels, or endpoint coordinates.',
            properties: {
              x: {
                type: 'number',
                description:
                  'Normalized top-left x coordinate, 0.0 through 1.0.',
              },
              y: {
                type: 'number',
                description:
                  'Normalized top-left y coordinate, 0.0 through 1.0.',
              },
              width: {
                type: 'number',
                description:
                  'Normalized width dimension; x + width must be <= 1.0.',
              },
              height: {
                type: 'number',
                description:
                  'Normalized height dimension; y + height must be <= 1.0.',
              },
            },
            required: ['x', 'y', 'width', 'height'],
          },
          groupKey: {
            type: 'string',
            description:
              'Group-local identity shared by every active component and its optional inactive composite alternative for the same visible dish.',
          },
          representationMode: {
            type: 'string',
            enum: [...PHOTO_REPRESENTATION_MODES],
            description:
              'semantic representation choice for one group: decomposed for independently identifiable visible foods, or composite when boundaries are blended, speculative, or unsafe to separate without double counting.',
          },
          representationKind: {
            type: 'string',
            enum: [...PHOTO_REPRESENTATION_KINDS],
            description:
              'Component for one independently identifiable visible food, or composite for one inseparable dish representation.',
          },
          active: {
            type: 'boolean',
            description:
              'Only one representation mode per group is active; inactive alternatives remain available for deterministic backend selection.',
          },
          coverage: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Distinct semantic labels for visible food matter represented by this row. Active component coverage must not overlap.',
          },
          excludedCoverage: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Only composite items may use exclusion references, and they may reference only valid same-group coverage. Component items must return an empty list; never use exclusions to remove another component.',
          },
          representationConfidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          visiblePortionDescription: { type: 'string' },
        },
        required: [
          'name',
          'identityConfidence',
          'quantityState',
          'quantityAmount',
          'quantityUnit',
          'quantityCountLabel',
          'quantityRawText',
          'quantityConfidence',
          'massEstimateGrams',
          'massEstimateConfidence',
          'preparationForm',
          'region',
          'groupKey',
          'representationMode',
          'representationKind',
          'active',
          'coverage',
          'excludedCoverage',
          'representationConfidence',
          'visiblePortionDescription',
        ],
      },
    },
  },
  required: ['items'],
} as const;

function aiUnavailable(
  message: string,
  publicMessageKey?: 'photo_analysis_incomplete_photo',
): AppError {
  return new AppError(
    503,
    'AI_UNAVAILABLE',
    message,
    publicMessageKey === undefined ? {} : { publicMessageKey },
  );
}

function providerRateLimited(): AppError {
  return new AppError(
    429,
    'RATE_LIMITED',
    'Photo analysis is temporarily limited. Try again later.',
  );
}

function logDiagnostic(category: string, details: Record<string, unknown>) {
  emitServerDiagnostic(
    category,
    photoAnalysisDiagnosticDetails(details),
    'photo-analysis:provider',
  );
}

type GeminiPart = Record<string, unknown>;
type GeminiCandidate = {
  content?: { role?: unknown; parts?: unknown };
  finishReason?: unknown;
  finishMessage?: unknown;
  safetyRatings?: unknown;
};
type GeminiResponsePayload = {
  candidates?: unknown;
  promptFeedback?: { blockReason?: unknown; safetyRatings?: unknown };
};

function partType(part: GeminiPart): string {
  const known = Object.keys(part).filter(
    (key) => key !== 'thought' && key !== 'thoughtSignature',
  );
  return known.length > 0 ? known.join(',') : 'thought_metadata';
}

function isThoughtPart(part: GeminiPart): boolean {
  return part.thought === true;
}

function responseTextParts(
  candidate: GeminiCandidate,
  metadata: Record<string, unknown>,
): string {
  const rawParts = candidate.content?.parts;
  if (!Array.isArray(rawParts)) {
    logDiagnostic('provider_empty_output', metadata);
    throw aiUnavailable(
      'Photo analysis could not be completed. Please try another photo.',
      'photo_analysis_incomplete_photo',
    );
  }

  const parts = rawParts.filter(
    (part): part is GeminiPart => typeof part === 'object' && part !== null,
  );
  if (parts.length !== rawParts.length) {
    logDiagnostic('provider_unsupported_part', metadata);
    throw aiUnavailable('Photo analysis returned an unsupported response.');
  }

  const output: string[] = [];
  for (const part of parts) {
    if (isThoughtPart(part)) continue;
    if (typeof part.text === 'string') {
      output.push(part.text);
      continue;
    }
    logDiagnostic('provider_unsupported_part', {
      ...metadata,
      unsupportedPartType: partType(part),
    });
    throw aiUnavailable('Photo analysis returned an unsupported response.');
  }

  const assembled = output.join('');
  if (assembled.trim() === '') {
    logDiagnostic('provider_empty_output', metadata);
    throw aiUnavailable(
      'Photo analysis could not be completed. Please try another photo.',
      'photo_analysis_incomplete_photo',
    );
  }
  return assembled;
}

class ProviderJsonSyntaxError extends Error {}

export function parsePhotoServingText(input: {
  quantityText: string | null;
  servingText: string | null;
}): ParsedServingSuggestion {
  const parsed = parseServingText(input);
  if (
    parsed.status === 'needs_review' &&
    parsed.reason === 'missing_unit' &&
    input.servingText !== null
  ) {
    const servingOnly = parseServingText({ servingText: input.servingText });
    if (servingOnly.status === 'parsed') {
      return {
        ...servingOnly,
        rawQuantityText: input.quantityText,
        rawServingText: input.servingText,
      };
    }
  }
  return parsed;
}

function normalizeQuantity(input: {
  quantityState: PhotoQuantityState;
  quantityAmount: number | null;
  quantityUnit: PhotoQuantityUnit | null;
  quantityCountLabel: string | null;
  quantityRawText: string | null;
  quantityConfidence: PhotoConfidenceLevel | null;
  massEstimateGrams: number | null;
  massEstimateConfidence: PhotoConfidenceLevel | null;
}): ProviderPhotoQuantity {
  if (
    input.quantityState === 'no_responsible_estimate' &&
    (input.quantityAmount !== null ||
      input.quantityUnit !== null ||
      input.quantityCountLabel !== null ||
      input.quantityRawText !== null ||
      input.quantityConfidence !== null)
  ) {
    throw aiUnavailable('Photo analysis returned contradictory quantity data.');
  }
  if (
    input.quantityState === 'no_responsible_estimate' &&
    (input.massEstimateGrams !== null || input.massEstimateConfidence !== null)
  ) {
    throw aiUnavailable('Photo analysis returned contradictory mass data.');
  }
  if (
    input.massEstimateGrams !== null &&
    input.massEstimateConfidence === null
  ) {
    throw aiUnavailable('Photo analysis returned an unlabelled mass estimate.');
  }

  const quantity =
    input.quantityState === 'estimated'
      ? {
          state: 'estimated' as const,
          amount: input.quantityAmount,
          unit: input.quantityUnit,
          // countLabel is optional display metadata. Gemini occasionally emits
          // one alongside an otherwise valid mass/volume quantity. Discard the
          // inapplicable field before strict semantic validation; count
          // quantities still require and validate a defensible object label.
          countLabel:
            input.quantityUnit === 'count' ? input.quantityCountLabel : null,
          rawText: input.quantityRawText,
          confidence: input.quantityConfidence,
          ...(input.massEstimateGrams === null
            ? {}
            : { massEstimateGrams: input.massEstimateGrams }),
          ...(input.massEstimateConfidence === null
            ? {}
            : { massEstimateConfidence: input.massEstimateConfidence }),
        }
      : { state: 'no_responsible_estimate' as const };

  const parsed = photoProvisionalQuantitySchema.safeParse(quantity);
  if (!parsed.success) {
    logDiagnostic('quantity_semantic_validation_failure', {
      errorCategory: 'schema_validation',
    });
    throw aiUnavailable('Photo analysis returned an invalid quantity.');
  }

  return parsed.data.state === 'estimated'
    ? {
        quantityState: 'estimated',
        quantityAmount: parsed.data.amount,
        quantityUnit: parsed.data.unit,
        quantityCountLabel: parsed.data.countLabel,
        quantityRawText: parsed.data.rawText,
        quantityConfidence: parsed.data.confidence,
        ...(parsed.data.massEstimateGrams === null
          ? {}
          : { massEstimateGrams: parsed.data.massEstimateGrams }),
        ...(parsed.data.massEstimateConfidence === null
          ? {}
          : { massEstimateConfidence: parsed.data.massEstimateConfidence }),
      }
    : {
        quantityState: 'no_responsible_estimate',
        quantityAmount: null,
        quantityUnit: null,
        quantityCountLabel: null,
        quantityRawText: null,
        quantityConfidence: null,
      };
}

type OptionalRegionViolationCategory =
  | 'malformed_object'
  | 'missing_fields'
  | 'non_numeric'
  | 'non_finite'
  | 'below_zero'
  | 'above_one'
  | 'reversed_bounds'
  | 'zero_area';

const optionalRegionFields = ['x', 'y', 'width', 'height'] as const;

function optionalRegionViolationCategories(
  value: unknown,
): OptionalRegionViolationCategory[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['malformed_object'];
  }

  const region = value as Record<string, unknown>;
  const categories = new Set<OptionalRegionViolationCategory>();
  if (
    Object.keys(region).some(
      (field) =>
        !optionalRegionFields.includes(
          field as (typeof optionalRegionFields)[number],
        ),
    )
  ) {
    categories.add('malformed_object');
  }
  const missing = optionalRegionFields.filter((field) => !(field in region));
  if (missing.length > 0) categories.add('missing_fields');

  for (const field of optionalRegionFields) {
    const coordinate = region[field];
    if (typeof coordinate !== 'number') {
      categories.add('non_numeric');
      continue;
    }
    if (!Number.isFinite(coordinate)) {
      categories.add('non_finite');
      continue;
    }
    if (coordinate < 0) categories.add('below_zero');
    if (coordinate > 1) categories.add('above_one');
  }

  const x = region.x;
  const y = region.y;
  const width = region.width;
  const height = region.height;
  if (
    typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof width === 'number' &&
    Number.isFinite(width)
  ) {
    if (width < 0) categories.add('reversed_bounds');
    if (width === 0) categories.add('zero_area');
    if (x + width > 1) categories.add('above_one');
  }
  if (
    typeof y === 'number' &&
    Number.isFinite(y) &&
    typeof height === 'number' &&
    Number.isFinite(height)
  ) {
    if (height < 0) categories.add('reversed_bounds');
    if (height === 0) categories.add('zero_area');
    if (y + height > 1) categories.add('above_one');
  }

  return [...categories];
}

function parseOptionalRegion(
  value: unknown,
  itemIndex: number,
): {
  region: ProviderPhotoSuggestion['region'];
  discarded: boolean;
} {
  if (value === null || value === undefined) {
    return { region: null, discarded: false };
  }

  const violationCategories = optionalRegionViolationCategories(value);
  const parsed = photoNormalizedRegionSchema.safeParse(value);
  if (parsed.success && violationCategories.length === 0) {
    return { region: parsed.data, discarded: false };
  }

  logDiagnostic('provider_optional_region_discarded', {
    itemIndex,
    invalidFieldPaths: parsed.success
      ? violationCategories.includes('zero_area')
        ? [['width'], ['height']]
        : []
      : parsed.error.issues.map((issue) => issue.path.map(String)),
    violationCategories,
  });
  return { region: null, discarded: true };
}

function parseProviderOutput(text: string): ProviderPhotoSuggestion[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text.trim());
  } catch {
    throw new ProviderJsonSyntaxError();
  }

  const parsed = providerOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    logDiagnostic('schema_validation_failure', {
      errorCategory: 'schema_validation',
    });
    throw aiUnavailable('Photo analysis returned an invalid response.');
  }

  return parsed.data.items.map((item, itemIndex) => {
    const parsedRegion = parseOptionalRegion(item.region, itemIndex);
    return {
      name: item.name,
      preparationForm: item.preparationForm,
      identityConfidence: item.identityConfidence,
      quantity: normalizeQuantity(item),
      region: parsedRegion.region,
      regionWasDiscarded: parsedRegion.discarded,
      representation: {
        groupKey: item.groupKey,
        representationMode: item.representationMode,
        representationKind: item.representationKind,
        active: item.active,
        coverage: item.coverage,
        excludedCoverage: item.excludedCoverage,
        representationConfidence: item.representationConfidence,
        visiblePortionDescription: item.visiblePortionDescription,
      },
    };
  });
}

class DisabledPhotoAnalysisProvider implements PhotoAnalysisProvider {
  async analyze(): Promise<ProviderPhotoSuggestion[]> {
    throw aiUnavailable('Photo analysis is turned off.');
  }
}

class MockPhotoAnalysisProvider implements PhotoAnalysisProvider {
  async analyze(): Promise<ProviderPhotoSuggestion[]> {
    return [
      {
        name: 'chicken',
        preparationForm: null,
        quantity: {
          quantityState: 'no_responsible_estimate',
          quantityAmount: null,
          quantityUnit: null,
          quantityCountLabel: null,
          quantityRawText: null,
          quantityConfidence: null,
          massEstimateGrams: null,
          massEstimateConfidence: null,
        },
        identityConfidence: 'medium',
        region: null,
        regionWasDiscarded: false,
        representation: {
          groupKey: null,
          representationMode: null,
          representationKind: null,
          active: true,
          coverage: [],
          excludedCoverage: [],
          representationConfidence: null,
          visiblePortionDescription: null,
        },
      },
    ];
  }
}

class GeminiPhotoAnalysisProvider implements PhotoAnalysisProvider {
  constructor(private readonly config: PhotoAnalysisConfig) {}

  async analyze(input: {
    image: Uint8Array;
    mimeType: 'image/jpeg';
    signal: AbortSignal;
  }): Promise<ProviderPhotoSuggestion[]> {
    if (this.config.geminiApiKey === null) {
      throw aiUnavailable('Photo analysis is not configured.');
    }

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    if (input.signal.aborted) controller.abort();
    input.signal.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          this.config.geminiModel,
        )}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.config.geminiApiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: input.mimeType,
                      data: Buffer.from(input.image).toString('base64'),
                    },
                  },
                  {
                    text: [
                      'Analyze this food photo and return structured JSON only.',
                      'Return zero to ten bounded representation items, with no more than eight active rows.',
                      'Identify food names and optional preparation forms only.',
                      'For every active independently visible food component, make an independent quantity decision as well as an identity decision. Attempt a useful structured quantity before declining. Use only count, slice, piece, tablespoon, teaspoon, cup, millilitre, gram, or ounce.',
                      'Use count only for visually countable discrete objects and include a concise count label such as egg, sandwich, breast, patty, or dumpling.',
                      'Prefer familiar household units and appropriately rounded approximate values when the image supports them. A clearly visible separable topping gets its own quantity attempt even when it is placed on another food. Do not split one physical food into subparts or repeat a coverage label; each active decomposed component must claim distinct visible food matter.',
                      'Never use generic count labels such as item, food, serving, meal, pasta, sauce, Parmesan, cheese, or rice.',
                      'For pasta, rice, sauce, grated cheese, and similar foods, consider tablespoon, teaspoon, cup, millilitre, gram, or ounce and choose a rounded approximate quantity when visually supportable. Do not decline merely because the estimate is approximate. Use low-confidence structured quantities when useful evidence exists but precision is limited; preserve them for review.',
                      'Use no_responsible_estimate only after considering all supported units and determining that the image genuinely does not support a useful amount. It is a blank review state, not a provider serving default and never a substitute for 100 g. Use quantityState estimated with positive quantityAmount, quantityUnit, quantityRawText, and quantityConfidence when estimating, including low-confidence estimates. Use no_responsible_estimate with all other quantity fields null only when no responsible quantity attempt is possible.',
                      'Do not invent exact weight, density, serving conversions, calories, protein, carbohydrates, fat, micronutrients, database IDs, trusted-food references, or reasoning.',
                      'Regions are optional. If provided, use decimal values from 0.0 through 1.0 only: x and y are normalized top-left coordinates, width and height are normalized dimensions, x + width must be at most 1.0, and y + height must be at most 1.0. Never use percentages such as 25 or 75, pixel coordinates, or endpoint coordinates. Omit the region or return null when uncertain or when the box cannot stay inside the image.',
                      'First inventory every clearly visible food that can be logged independently before choosing a representation. Emit one component row for each such food; a main food plus a visible topping is normally at least two components.',
                      'For visibly distinct, defensible foods, group components with one groupKey, use representationMode decomposed, representationKind component, active true, and non-overlapping coverage labels. Treat clearly visible toppings and independently identifiable sides as separate components when they can be logged independently.',
                      'Component items must set excludedCoverage to an empty list. Only an active composite may exclude valid same-group component coverage to prevent double counting; never put exclusion references on a component.',
                      'Do not combine separable components merely to create a natural-language dish title. A topping being on the same plate or on top of another food does not by itself make the foods inseparable.',
                      'Regions are supporting spatial evidence only. Do not require a region to preserve or select a semantic component; use identity, coverage, separation confidence, and double-count risk when a region is missing or invalid.',
                      'Use decomposed only with at least two distinct active components; otherwise use one active composite. Keep only one active representation per group and mark alternatives active false.',
                      'Every component alternative and its composite alternative for the same dish must share one groupKey. If you use decomposed, emit every independently loggable component in that same group; never emit a singleton decomposed group. Never emit a singleton component alongside a composite that contains additional visible food.',
                      'Separate-component examples include toast with a visible fried egg, rice with a visible chicken breast, pasta with visibly grated cheese, yogurt with visible berries, and salad with a separately visible protein topping.',
                      'Avoid speculative decomposition of blended sauces, soups, smoothies, casseroles, and mixed fillings. For blended or inseparable dishes, use one active composite item. Do not list an ingredient separately when its nutrition is already inseparable from the active composite.',
                      'Composite examples include a smoothie, blended soup, casserole, mixed curry, hidden sauce ingredients, or ground or melted ingredients that cannot be independently portioned. Do not extract hidden ingredients from sauces or mixed dishes.',
                      'When uncertain, provide both a complete component alternative and one complete composite alternative under the same groupKey so the backend can select one without overlapping nutrition.',
                      'You may include at most one inactive alternative representation per group; inactive items must use active false.',
                      'Alternatives are optional; omit them unless structurally complete. Do not generate application IDs, active item ID arrays, loggable or overlap state, database references, nutrition, conversions, or reasoning.',
                      'Use only group-local keys and coverage labels; never return database IDs. Coverage labels must name visible food matter and may not be food, meal, item, or serving.',
                    ].join('\n'),
                  },
                ],
              },
            ],
            generationConfig: {
              candidateCount: 1,
              thinkingConfig: { thinkingBudget: 0 },
              temperature: 0.1,
              maxOutputTokens: this.config.maxOutputTokens,
              responseMimeType: 'application/json',
              responseSchema: geminiResponseSchema,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        logDiagnostic('non_ok_response', {
          status: response.status,
          operation: 'photo_analysis',
        });
        if (response.status === 429) throw providerRateLimited();
        throw aiUnavailable('Photo analysis could not be reached.');
      }

      let payload: GeminiResponsePayload;
      try {
        payload = (await response.json()) as GeminiResponsePayload;
      } catch {
        logDiagnostic('response_json_failure', {
          operation: 'photo_analysis',
          errorCategory: 'invalid_response',
        });
        throw aiUnavailable('Photo analysis returned an unreadable response.');
      }

      const candidates = Array.isArray(payload.candidates)
        ? payload.candidates
        : [];
      const candidateCount = candidates.length;
      const selectedCandidateIndex = 0;
      const candidate = candidates[selectedCandidateIndex] as
        | GeminiCandidate
        | undefined;
      const rawParts =
        candidate?.content !== undefined &&
        Array.isArray(candidate.content.parts)
          ? candidate.content.parts
          : [];
      const parts = rawParts.filter(
        (part): part is GeminiPart => typeof part === 'object' && part !== null,
      );
      const baseMetadata = {
        candidateCount,
        selectedCandidateIndex,
        contentPartCount: parts.length,
        finishReason:
          typeof candidate?.finishReason === 'string'
            ? candidate.finishReason
            : undefined,
      };
      const finishReason = candidate?.finishReason;
      if (finishReason !== 'STOP') {
        const category =
          finishReason === 'MAX_TOKENS'
            ? 'provider_output_truncated'
            : finishReason === undefined
              ? 'provider_incomplete_response'
              : 'provider_completion_error';
        logDiagnostic(category, baseMetadata);
        throw aiUnavailable(
          finishReason === 'MAX_TOKENS'
            ? 'Photo analysis was cut off. Try again.'
            : 'Photo analysis did not complete. Try again.',
        );
      }

      if (candidate === undefined) {
        logDiagnostic('provider_incomplete_response', baseMetadata);
        throw aiUnavailable('Photo analysis returned an incomplete response.');
      }

      const text = responseTextParts(candidate, baseMetadata);
      try {
        // Keep provider alternatives available for the representation adapter.
        // It enforces the eight-row active limit without silently truncating
        // active provider output here.
        return parseProviderOutput(text);
      } catch (error) {
        if (error instanceof ProviderJsonSyntaxError) {
          logDiagnostic('provider_malformed_completed_json', baseMetadata);
          throw aiUnavailable('Photo analysis returned invalid JSON.');
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof AppError) throw error;

      const aborted =
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError');
      logDiagnostic(aborted ? 'timeout_or_cancelled' : 'request_failure', {
        operation: 'photo_analysis',
        errorCategory: aborted ? 'timeout' : 'network_or_provider',
      });
      throw aiUnavailable(
        aborted ? 'Photo analysis timed out.' : 'Photo analysis failed.',
      );
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener('abort', abortFromCaller);
    }
  }
}

export function photoAnalysisProvider(
  config: PhotoAnalysisConfig,
): PhotoAnalysisProvider {
  if (config.provider === 'mock') return new MockPhotoAnalysisProvider();
  if (config.provider === 'gemini') {
    return new GeminiPhotoAnalysisProvider(config);
  }
  return new DisabledPhotoAnalysisProvider();
}

export { parseProviderOutput };
