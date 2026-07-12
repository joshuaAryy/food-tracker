import {
  classifyServingUnit,
  MAX_SERVING_QUANTITY,
  SERVING_UNITS,
  validateServingQuantity,
  type ServingUnit,
} from './servings.js';
import { z } from 'zod';

export type ParsedServingSuggestionReason =
  | 'no_explicit_serving'
  | 'missing_quantity'
  | 'missing_unit'
  | 'ambiguous_unit'
  | 'ambiguous_size'
  | 'unsupported_serving_text'
  | 'invalid_quantity'
  | 'quantity_out_of_range'
  | 'unsupported_unit';

const rawServingFieldsSchema = {
  rawQuantityText: z.string().nullable(),
  rawServingText: z.string().nullable(),
};

export const parsedServingSuggestionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('parsed'),
    quantity: z.number().finite().positive().max(MAX_SERVING_QUANTITY),
    unit: z.enum(SERVING_UNITS),
    ...rawServingFieldsSchema,
  }),
  z.strictObject({
    status: z.literal('missing'),
    quantity: z.null(),
    unit: z.null(),
    reason: z.literal('no_explicit_serving'),
    ...rawServingFieldsSchema,
  }),
  z.strictObject({
    status: z.literal('needs_review'),
    quantity: z.number().finite().nullable(),
    unit: z.enum(SERVING_UNITS).nullable(),
    reason: z.enum([
      'missing_quantity',
      'missing_unit',
      'ambiguous_unit',
      'ambiguous_size',
      'unsupported_serving_text',
    ]),
    ...rawServingFieldsSchema,
  }),
  z.strictObject({
    status: z.literal('invalid'),
    quantity: z.number().nullable(),
    unit: z.enum(SERVING_UNITS).nullable(),
    reason: z.enum([
      'invalid_quantity',
      'quantity_out_of_range',
      'unsupported_unit',
    ]),
    ...rawServingFieldsSchema,
  }),
]);

export type ParsedServingSuggestion = z.infer<
  typeof parsedServingSuggestionSchema
>;

type RawServingFields = Pick<
  ParsedServingSuggestion,
  'rawQuantityText' | 'rawServingText'
>;

export type ServingTextInput = {
  quantityText?: string | null;
  servingText?: string | null;
};

type ParsedSource = {
  quantity: number | null;
  unit: ServingUnit | null;
  reason:
    | 'invalid_quantity'
    | 'quantity_out_of_range'
    | 'ambiguous_unit'
    | 'ambiguous_size'
    | 'unsupported_serving_text'
    | null;
};

const numberWords: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
};

const unitPrefixes = [
  'metric teaspoon',
  'metric tablespoon',
  'metric cup',
  'us teaspoon',
  'us tablespoon',
  'us cup',
  'us fluid ounce',
  'imperial fluid ounce',
  'fluid ounce',
  'teaspoons',
  'tablespoons',
  'cups',
  'milliliters',
  'millilitres',
  'kilograms',
  'servings',
  'ounces',
  'pounds',
  'slices',
  'eggs',
  'bars',
  'items',
  'bowls',
  'plates',
  'handfuls',
  'medium items',
  'metric tsp',
  'metric tbsp',
  'metric cup',
  'us tsp',
  'us tbsp',
  'us cup',
  'us fl oz',
  'imperial fl oz',
  'fl oz',
  'gram',
  'grams',
  'kilogram',
  'liter',
  'litre',
  'liters',
  'litres',
  'milliliter',
  'millilitre',
  'ounce',
  'pound',
  'serving',
  'slice',
  'egg',
  'bar',
  'item',
  'bowl',
  'plate',
  'handful',
  'medium item',
  'g',
  'kg',
  'mg',
  'l',
  'ml',
  'oz',
  'lb',
  'cup',
  'tbsp',
  'tsp',
];

function rawValue(value: string | null | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizedText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function quantityPrefix(value: string): {
  quantity: number | null;
  rest: string;
} {
  const normalized = normalizedText(value);
  const mixed = /^(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)(.*)$/.exec(normalized);
  if (mixed !== null) {
    const denominator = Number(mixed[3]);
    return {
      quantity:
        denominator === 0
          ? Number.NaN
          : Number(mixed[1]) + Number(mixed[2]) / denominator,
      rest: mixed[4]?.trim() ?? '',
    };
  }

  const fraction = /^(\d+)\s*\/\s*(\d+)(.*)$/.exec(normalized);
  if (fraction !== null) {
    const denominator = Number(fraction[2]);
    return {
      quantity:
        denominator === 0 ? Number.NaN : Number(fraction[1]) / denominator,
      rest: fraction[3]?.trim() ?? '',
    };
  }

  if (/^\d+\s*\//.test(normalized)) {
    return { quantity: Number.NaN, rest: normalized };
  }

  const word =
    /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)\b(.*)$/i.exec(
      normalized,
    );
  if (word !== null) {
    return {
      quantity: numberWords[word[1]?.toLocaleLowerCase() ?? ''] ?? null,
      rest: word[2]?.trim() ?? '',
    };
  }

  const decimal = /^([-+]?(?:\d+(?:\.\d*)?|\.\d+))(.*)$/.exec(normalized);
  if (decimal !== null) {
    return {
      quantity: Number(decimal[1]),
      rest: decimal[2]?.trim() ?? '',
    };
  }

  return { quantity: null, rest: normalized };
}

function prefixUnit(value: string): {
  unit: ServingUnit | null;
  ambiguous: boolean;
  unsupported: boolean;
} {
  const normalized = normalizedText(value).replace(/^(of|the)\s+/, '');
  if (normalized === '') {
    return { unit: null, ambiguous: false, unsupported: false };
  }

  if (/\s(?:or|and)\s|\//i.test(normalized)) {
    return { unit: null, ambiguous: true, unsupported: false };
  }

  const prefix = unitPrefixes.find((candidate) =>
    new RegExp(
      `^${candidate.replace(/ /g, '\\s+').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s|$)`,
      'i',
    ).test(normalized),
  );
  if (prefix === undefined) {
    return { unit: null, ambiguous: false, unsupported: true };
  }

  const unit = classifyServingUnit(prefix);
  return unit === null
    ? { unit: null, ambiguous: false, unsupported: true }
    : { unit: unit.unit, ambiguous: false, unsupported: false };
}

function parseSource(value: string): ParsedSource {
  const parsed = quantityPrefix(value);
  const unit = prefixUnit(parsed.rest);
  const lower = normalizedText(value);

  if (/^(?:nan|infinity|inf)\b/.test(lower)) {
    return {
      quantity: Number.NaN,
      unit: unit.unit,
      reason: 'invalid_quantity',
    };
  }

  if (parsed.quantity !== null) {
    if (!Number.isFinite(parsed.quantity) || parsed.quantity <= 0) {
      return {
        quantity: parsed.quantity,
        unit: unit.unit,
        reason: 'invalid_quantity',
      };
    }
    if (parsed.quantity > MAX_SERVING_QUANTITY) {
      return {
        quantity: parsed.quantity,
        unit: unit.unit,
        reason: 'quantity_out_of_range',
      };
    }
    if (unit.ambiguous) {
      return {
        quantity: parsed.quantity,
        unit: null,
        reason: 'ambiguous_unit',
      };
    }
    if (unit.unsupported) {
      return {
        quantity: parsed.quantity,
        unit: null,
        reason: /^(?:medium|small|large)\b/.test(lower)
          ? 'ambiguous_size'
          : 'unsupported_serving_text',
      };
    }
    return { quantity: parsed.quantity, unit: unit.unit, reason: null };
  }

  if (unit.ambiguous) {
    return { quantity: null, unit: null, reason: 'ambiguous_unit' };
  }
  if (unit.unsupported) {
    return {
      quantity: null,
      unit: null,
      reason: /^(?:medium|small|large)\b/.test(lower)
        ? 'ambiguous_size'
        : 'unsupported_serving_text',
    };
  }
  return { quantity: null, unit: unit.unit, reason: null };
}

function resultFields(input: ServingTextInput): RawServingFields {
  return {
    rawQuantityText: rawValue(input.quantityText),
    rawServingText: rawValue(input.servingText),
  };
}

export function parseServingText(
  input: ServingTextInput,
): ParsedServingSuggestion {
  const fields = resultFields(input);
  const sources = [fields.rawQuantityText, fields.rawServingText].filter(
    (value): value is string => value !== null && value.trim() !== '',
  );

  if (sources.length === 0) {
    return {
      status: 'missing',
      quantity: null,
      unit: null,
      reason: 'no_explicit_serving',
      ...fields,
    };
  }

  const parsed = sources.map(parseSource);
  type ParseFailure = Exclude<ParsedSource['reason'], null>;
  const failure = parsed
    .map((value) => value.reason)
    .find((reason): reason is ParseFailure => reason !== null);
  if (failure === 'invalid_quantity' || failure === 'quantity_out_of_range') {
    return {
      status: 'invalid',
      quantity:
        parsed.find((value) => value.quantity !== null)?.quantity ?? null,
      unit: parsed.find((value) => value.unit !== null)?.unit ?? null,
      reason: failure,
      ...fields,
    };
  }
  if (failure !== undefined) {
    return {
      status: 'needs_review',
      quantity:
        parsed.find((value) => value.quantity !== null)?.quantity ?? null,
      unit: parsed.find((value) => value.unit !== null)?.unit ?? null,
      reason: failure,
      ...fields,
    };
  }

  const quantity =
    parsed.find((value) => value.quantity !== null)?.quantity ?? null;
  const unit = parsed.find((value) => value.unit !== null)?.unit ?? null;
  if (quantity === null && unit === null) {
    return {
      status: 'needs_review',
      quantity: null,
      unit: null,
      reason: 'missing_quantity',
      ...fields,
    };
  }
  if (quantity === null) {
    return {
      status: 'needs_review',
      quantity: null,
      unit,
      reason: 'missing_quantity',
      ...fields,
    };
  }
  if (unit === null) {
    return {
      status: 'needs_review',
      quantity,
      unit: null,
      reason: 'missing_unit',
      ...fields,
    };
  }

  const validation = validateServingQuantity(quantity);
  if (!validation.success) {
    return {
      status: validation.error.code === 'ABOVE_MAXIMUM' ? 'invalid' : 'invalid',
      quantity,
      unit,
      reason:
        validation.error.code === 'ABOVE_MAXIMUM'
          ? 'quantity_out_of_range'
          : 'invalid_quantity',
      ...fields,
    };
  }

  return { status: 'parsed', quantity, unit, ...fields };
}
