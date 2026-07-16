import {
  classifyServingUnit,
  resolveServingRequest,
  roundServingNutritionForStorage,
  scaleNutritionAtFullPrecision,
  validateServingQuantity,
  type FoodItemServingOptions,
  type ScalableNutrition,
  type ServingResolutionReason,
} from '@food-tracker/shared';

export type ServingPreviewBasis = {
  name: string;
  servingQuantity: number | null;
  servingUnit: string | null;
  nutrition: ScalableNutrition;
  servingOptions: FoodItemServingOptions | null;
};

export type ServingPreviewRequest = {
  quantity?: number;
  quantityText?: string;
  unit: string;
  servingOptionId?: string | null;
};

export type ServingChoice = {
  id: string;
  label: string;
  unit: string;
  servingOptionId: string | null;
  quantity?: number;
};

export type ServingUnitChangeResult =
  | {
      kind: 'converted';
      exactConvertedQuantity: number;
      persistedQuantity: number;
      displayText: string;
      targetUnit: string;
    }
  | { kind: 'too_small'; targetUnit: string; reason: string }
  | { kind: 'incompatible'; reason: string };

export type ServingChoiceState = {
  amount: string;
  unit: string;
  servingOptionId: string | null;
};

export function convertServingAmountForUnitChange(input: {
  amount: number;
  fromUnit: string;
  toUnit: string;
}): ServingUnitChangeResult {
  const from = classifyServingUnit(input.fromUnit);
  const to = classifyServingUnit(input.toUnit);
  if (from === null || to === null || from.family !== to.family)
    return {
      kind: 'incompatible',
      reason: 'Choose a compatible unit or a listed serving for this food.',
    };
  const resolution = resolveServingRequest({
    request: { quantity: input.amount, unit: from.unit },
    basis: { quantity: 1, unit: to.unit },
    servingOptions: [],
  });
  if (
    (resolution.status !== 'exact' && resolution.status !== 'converted') ||
    resolution.multiplier === null
  ) {
    return {
      kind: 'incompatible',
      reason: 'Choose a compatible unit or a listed serving for this food.',
    };
  }
  const exactConvertedQuantity = Number(resolution.multiplier.toPrecision(15));
  const persistedQuantity =
    Math.round((exactConvertedQuantity + Number.EPSILON) * 100) / 100;
  if (persistedQuantity === 0)
    return {
      kind: 'too_small',
      targetUnit: to.unit,
      reason: `This amount is too small to represent in ${to.unit}. Use ${from.unit} or another compatible unit instead.`,
    };
  return {
    kind: 'converted',
    exactConvertedQuantity,
    persistedQuantity,
    displayText: String(persistedQuantity),
    targetUnit: to.unit,
  };
}

export function changeServingChoice(
  state: ServingChoiceState,
  choice: ServingChoice,
): ServingChoiceState & { error?: string } {
  if (
    state.amount.trim() === '' &&
    choice.quantity !== undefined &&
    Number.isFinite(choice.quantity) &&
    choice.quantity > 0
  ) {
    return {
      amount: String(choice.quantity),
      unit: choice.unit,
      servingOptionId: choice.servingOptionId,
    };
  }
  const result = convertServingAmountForUnitChange({
    amount: Number(state.amount),
    fromUnit: state.unit,
    toUnit: choice.unit,
  });
  if (result.kind === 'too_small' || result.kind === 'incompatible')
    return { ...state, error: result.reason };
  return {
    amount: result.displayText,
    unit: choice.unit,
    servingOptionId: choice.servingOptionId,
  };
}

type PreviewSuccess = {
  status: 'exact' | 'converted';
  message: null;
  multiplier: number;
  requestedServing: {
    quantity: number;
    unit: string;
    servingOptionId: string | null;
  };
  nutrition: ScalableNutrition;
  resolvedWeightGrams: number | null;
  resolvedVolumeMl: number | null;
};

type PreviewFailure = {
  status: 'needs_review' | 'invalid';
  message: string;
  multiplier: null;
  requestedServing: null;
  nutrition: null;
  resolvedWeightGrams: null;
  resolvedVolumeMl: null;
};

export type ProvisionalServingPreview = PreviewSuccess | PreviewFailure;

function unitLabel(unit: string): string {
  const labels: Record<string, string> = {
    g: 'g',
    kg: 'kg',
    oz: 'oz',
    lb: 'lb',
    ml: 'mL',
    l: 'L',
    metric_tsp: 'metric tsp',
    metric_tbsp: 'metric tbsp',
    metric_cup: 'metric cup',
    us_tsp: 'US tsp',
    us_tbsp: 'US tbsp',
    us_cup: 'US cup',
    us_fl_oz: 'US fl oz',
    imperial_fl_oz: 'imperial fl oz',
    tsp: 'tsp',
    tbsp: 'tbsp',
    cup: 'cup',
    fl_oz: 'fl oz',
    medium_item: 'medium item',
  };
  return labels[unit] ?? unit.replace(/_/g, ' ');
}

export function nutritionBasisLabel(basis: ServingPreviewBasis): string {
  if (basis.servingQuantity === null || basis.servingUnit === null) {
    return 'Nutrition basis is unavailable';
  }

  return (
    'Nutrition is listed per ' +
    String(basis.servingQuantity) +
    ' ' +
    unitLabel(basis.servingUnit)
  );
}

function previewMessage(reason: ServingResolutionReason): string {
  switch (reason) {
    case 'unknown_household_unit':
      return 'This food does not have a trusted cup conversion. Choose grams or a listed serving.';
    case 'ambiguous_serving_option':
      return 'Choose which listed serving size you meant.';
    case 'missing_conversion':
      return 'This food needs a listed serving relationship before that amount can be used.';
    case 'incompatible_unit':
      return 'Choose a compatible unit or a listed serving for this food.';
    case 'invalid_serving_option':
      return 'Choose another listed serving for this food.';
    case 'unsupported_unit':
      return 'Choose a supported unit or a listed serving.';
    case 'invalid_quantity':
      return 'Enter an amount greater than 0 and no more than 10,000.';
    case 'invalid_basis':
      return 'This food does not have a usable nutrition basis.';
    default:
      return 'This serving needs review before it can be saved.';
  }
}

function invalidPreview(message: string): PreviewFailure {
  return {
    status: 'invalid',
    message,
    multiplier: null,
    requestedServing: null,
    nutrition: null,
    resolvedWeightGrams: null,
    resolvedVolumeMl: null,
  };
}

function quantityForRequest(request: ServingPreviewRequest): number | null {
  if (request.quantity !== undefined) return request.quantity;
  if (
    request.quantityText === undefined ||
    request.quantityText.trim() === ''
  ) {
    return null;
  }

  const value = Number(request.quantityText);
  return Number.isFinite(value) ? value : null;
}

function exactlyStorable(quantity: number): boolean {
  return Math.abs(quantity - Math.round(quantity * 100) / 100) < 1e-9;
}

function baseChoices(unit: string): string[] {
  const classification = classifyServingUnit(unit);
  if (classification === null) return [];

  if (classification.family === 'mass') return ['g', 'kg', 'oz', 'lb'];
  if (classification.family === 'volume') return ['ml', 'l'];
  return [classification.unit];
}

export function availableServingChoices(
  basis: ServingPreviewBasis,
): ServingChoice[] {
  if (
    basis.servingUnit === null ||
    classifyServingUnit(basis.servingUnit) === null
  ) {
    return [];
  }

  const choices: ServingChoice[] = baseChoices(basis.servingUnit).map(
    (unit) => ({
      id: `unit:${unit}`,
      label: unitLabel(unit),
      unit,
      servingOptionId: null,
      ...(basis.servingQuantity === null
        ? {}
        : { quantity: basis.servingQuantity }),
    }),
  );
  const optionChoices = (basis.servingOptions?.options ?? []).map((option) => ({
    id: `option:${option.id}`,
    label: option.label,
    unit: option.unit,
    servingOptionId: option.id,
    quantity: option.quantity,
  }));

  return [...choices, ...optionChoices];
}

export function provisionalServingPreview(input: {
  basis: ServingPreviewBasis;
  request: ServingPreviewRequest;
}): ProvisionalServingPreview {
  const quantity = quantityForRequest(input.request);
  if (quantity === null || !validateServingQuantity(quantity).success) {
    return invalidPreview(
      'Enter an amount greater than 0 and no more than 10,000.',
    );
  }

  if (
    input.basis.servingQuantity === null ||
    input.basis.servingUnit === null ||
    classifyServingUnit(input.basis.servingUnit) === null
  ) {
    return invalidPreview('This food does not have a usable nutrition basis.');
  }

  const resolution = resolveServingRequest({
    request: {
      quantity,
      unit: input.request.unit,
      ...(input.request.servingOptionId === undefined
        ? {}
        : { servingOptionId: input.request.servingOptionId }),
    },
    basis: {
      quantity: input.basis.servingQuantity,
      unit: input.basis.servingUnit,
    },
    servingOptions: input.basis.servingOptions?.options ?? [],
  });

  if (
    (resolution.status !== 'exact' && resolution.status !== 'converted') ||
    resolution.multiplier === null ||
    resolution.requestedQuantity === null ||
    resolution.requestedUnit === null
  ) {
    return {
      status: resolution.status === 'needs_review' ? 'needs_review' : 'invalid',
      message: previewMessage(resolution.reason),
      multiplier: null,
      requestedServing: null,
      nutrition: null,
      resolvedWeightGrams: null,
      resolvedVolumeMl: null,
    };
  }

  if (!exactlyStorable(resolution.requestedQuantity)) {
    return invalidPreview(
      'Choose an amount that can be saved to two decimal places.',
    );
  }

  return {
    status: resolution.status,
    message: null,
    multiplier: resolution.multiplier,
    requestedServing: {
      quantity: resolution.requestedQuantity,
      unit: resolution.requestedUnit,
      servingOptionId: resolution.servingOptionId,
    },
    nutrition: roundServingNutritionForStorage(
      scaleNutritionAtFullPrecision(
        input.basis.nutrition,
        resolution.multiplier,
      ),
    ),
    resolvedWeightGrams: resolution.resolvedWeightGrams,
    resolvedVolumeMl: resolution.resolvedVolumeMl,
  };
}

export function backendServingMessage(code: string): string | null {
  const messages: Record<string, string> = {
    SERVING_CONFLICT: 'Choose one serving amount and unit before saving.',
    INVALID_SERVING_REQUEST: 'Check the amount and unit, then try again.',
    SERVING_NEEDS_REVIEW:
      'Choose grams, millilitres, or one of this food’s listed servings.',
    SERVING_RESOLUTION_INVALID:
      'Choose a compatible unit or a listed serving for this food.',
    INVALID_SERVING_BASIS: 'This food does not have a usable nutrition basis.',
    SERVING_UPDATE_UNAVAILABLE:
      'This older entry cannot recalculate its serving. You can still edit its saved details.',
    SERVING_OPTION_UNAVAILABLE:
      'That serving option is no longer available. Choose another listed serving.',
    SERVING_OVERRIDE_ACTION_REQUIRED:
      'Choose whether to remove or replace the nutrition adjustment before changing the serving.',
    SERVING_UPDATE_CONFLICT:
      'Finish the serving change before editing those nutrition details.',
    SNAPSHOT_NUTRITION_EDIT_REQUIRES_OVERRIDE:
      'Use the nutrition adjustment fields to update this serving-aware entry.',
  };
  return messages[code] ?? null;
}
