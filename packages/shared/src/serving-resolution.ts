import {
  calculateServingMultiplier,
  classifyServingUnit,
  validateServingQuantity,
  type ServingUnit,
  type ServingUnitClassification,
  type ServingUnitFamily,
} from './servings.js';

export type ServingResolutionStatus =
  | 'exact'
  | 'converted'
  | 'needs_review'
  | 'invalid';

export type ServingResolutionReason =
  | 'same_basis'
  | 'standard_mass_conversion'
  | 'standard_volume_conversion'
  | 'trusted_serving_weight'
  | 'trusted_serving_volume'
  | 'direct_count_basis'
  | 'unknown_household_unit'
  | 'missing_conversion'
  | 'ambiguous_serving_option'
  | 'incompatible_unit'
  | 'invalid_quantity'
  | 'unsupported_unit'
  | 'invalid_basis'
  | 'invalid_serving_option';

export interface NutritionBasis {
  quantity: number;
  unit: string;
  displayText?: string;
}

export interface ServingOption {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  equivalentWeightGrams?: number | null;
  equivalentVolumeMl?: number | null;
  source: 'basis' | 'provider' | 'manual';
  trust: 'trusted';
  providerDescription?: string | null;
}

export interface ServingRequest {
  quantity: number;
  unit: string;
  servingOptionId?: string | null;
}

export interface ServingResolution {
  status: ServingResolutionStatus;
  reason: ServingResolutionReason;
  requestedQuantity: number | null;
  requestedUnit: string | null;
  requestedUnitFamily: ServingUnitFamily | null;
  basisQuantity: number | null;
  basisUnit: string | null;
  basisUnitFamily: ServingUnitFamily | null;
  servingOptionId: string | null;
  multiplier: number | null;
  resolvedWeightGrams: number | null;
  resolvedVolumeMl: number | null;
}

export interface ServingResolutionInput {
  request: ServingRequest;
  basis: NutritionBasis;
  servingOptions?: readonly ServingOption[];
}

const massToGrams: Readonly<Record<'g' | 'kg' | 'mg' | 'oz' | 'lb', number>> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.349523125,
  lb: 453.59237,
};

const volumeToMl: Readonly<
  Record<
    | 'ml'
    | 'l'
    | 'metric_tsp'
    | 'metric_tbsp'
    | 'metric_cup'
    | 'us_tsp'
    | 'us_tbsp'
    | 'us_cup'
    | 'us_fl_oz'
    | 'imperial_fl_oz',
    number
  >
> = {
  ml: 1,
  l: 1000,
  metric_tsp: 5,
  metric_tbsp: 15,
  metric_cup: 250,
  us_tsp: 4.92892159375,
  us_tbsp: 14.78676478125,
  us_cup: 236.5882365,
  us_fl_oz: 29.5735295625,
  imperial_fl_oz: 28.4130625,
};

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonEmptyTextOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function gramsFor(quantity: number, unit: ServingUnit): number | null {
  const factor = massToGrams[unit as keyof typeof massToGrams];
  return factor === undefined ? null : quantity * factor;
}

function millilitresFor(quantity: number, unit: ServingUnit): number | null {
  const factor = volumeToMl[unit as keyof typeof volumeToMl];
  return factor === undefined ? null : quantity * factor;
}

function resolution(
  input: ServingResolutionInput,
  requestUnit: ServingUnitClassification | null,
  basisUnit: ServingUnitClassification | null,
  status: ServingResolutionStatus,
  reason: ServingResolutionReason,
  values: Partial<
    Pick<
      ServingResolution,
      | 'servingOptionId'
      | 'multiplier'
      | 'resolvedWeightGrams'
      | 'resolvedVolumeMl'
    >
  > = {},
): ServingResolution {
  return {
    status,
    reason,
    requestedQuantity: finiteNumberOrNull(input.request.quantity),
    requestedUnit: requestUnit?.unit ?? nonEmptyTextOrNull(input.request.unit),
    requestedUnitFamily: requestUnit?.family ?? null,
    basisQuantity: finiteNumberOrNull(input.basis.quantity),
    basisUnit: basisUnit?.unit ?? nonEmptyTextOrNull(input.basis.unit),
    basisUnitFamily: basisUnit?.family ?? null,
    servingOptionId:
      values.servingOptionId ?? input.request.servingOptionId ?? null,
    multiplier: values.multiplier ?? null,
    resolvedWeightGrams: values.resolvedWeightGrams ?? null,
    resolvedVolumeMl: values.resolvedVolumeMl ?? null,
  };
}

interface ValidServingOption {
  option: ServingOption;
  unit: ServingUnitClassification;
  equivalentWeightGrams: number | null;
  equivalentVolumeMl: number | null;
}

function optionalEquivalent(value: number | null | undefined): number | null {
  return value === undefined || value === null ? null : value;
}

function validServingOption(option: ServingOption): ValidServingOption | null {
  const quantity = validateServingQuantity(option.quantity);
  const unit = classifyServingUnit(option.unit);
  const weight = optionalEquivalent(option.equivalentWeightGrams);
  const volume = optionalEquivalent(option.equivalentVolumeMl);
  const validWeight =
    weight === null || validateServingQuantity(weight).success;
  const validVolume =
    volume === null || validateServingQuantity(volume).success;

  if (
    option.id.trim() === '' ||
    option.label.trim() === '' ||
    !quantity.success ||
    unit === null ||
    !validWeight ||
    !validVolume ||
    !['basis', 'provider', 'manual'].includes(option.source) ||
    option.trust !== 'trusted'
  ) {
    return null;
  }

  return {
    option,
    unit,
    equivalentWeightGrams: weight,
    equivalentVolumeMl: volume,
  };
}

function optionCanResolve(
  option: ValidServingOption,
  requestUnit: ServingUnitClassification,
  basisUnit: ServingUnitClassification,
): boolean {
  if (requestUnit.unit === option.unit.unit) {
    return (
      (basisUnit.family === 'mass' && option.equivalentWeightGrams !== null) ||
      (basisUnit.family === 'volume' && option.equivalentVolumeMl !== null)
    );
  }

  if (option.unit.unit !== basisUnit.unit) return false;

  return (
    (requestUnit.family === 'mass' && option.equivalentWeightGrams !== null) ||
    (requestUnit.family === 'volume' && option.equivalentVolumeMl !== null)
  );
}

function resolvedFromOption(input: {
  requestQuantity: number;
  requestUnit: ServingUnitClassification;
  basisQuantity: number;
  basisUnit: ServingUnitClassification;
  servingOption: ValidServingOption;
}): {
  reason: 'trusted_serving_weight' | 'trusted_serving_volume';
  multiplier: number;
  resolvedWeightGrams: number | null;
  resolvedVolumeMl: number | null;
} | null {
  const option = input.servingOption;

  if (input.requestUnit.unit === option.unit.unit) {
    const optionMultiplier = input.requestQuantity / option.option.quantity;

    if (
      input.basisUnit.family === 'mass' &&
      option.equivalentWeightGrams !== null
    ) {
      const basisWeight = gramsFor(input.basisQuantity, input.basisUnit.unit);
      const resolvedWeight = option.equivalentWeightGrams * optionMultiplier;
      if (basisWeight === null || basisWeight <= 0) return null;
      return {
        reason: 'trusted_serving_weight',
        multiplier: resolvedWeight / basisWeight,
        resolvedWeightGrams: resolvedWeight,
        resolvedVolumeMl: null,
      };
    }

    if (
      input.basisUnit.family === 'volume' &&
      option.equivalentVolumeMl !== null
    ) {
      const basisVolume = millilitresFor(
        input.basisQuantity,
        input.basisUnit.unit,
      );
      const resolvedVolume = option.equivalentVolumeMl * optionMultiplier;
      if (basisVolume === null || basisVolume <= 0) return null;
      return {
        reason: 'trusted_serving_volume',
        multiplier: resolvedVolume / basisVolume,
        resolvedWeightGrams: null,
        resolvedVolumeMl: resolvedVolume,
      };
    }
  }

  if (option.unit.unit !== input.basisUnit.unit) return null;

  if (
    input.requestUnit.family === 'mass' &&
    option.equivalentWeightGrams !== null
  ) {
    const requestedWeight = gramsFor(
      input.requestQuantity,
      input.requestUnit.unit,
    );
    if (requestedWeight === null) return null;
    const basisUnits =
      (requestedWeight / option.equivalentWeightGrams) * option.option.quantity;
    return {
      reason: 'trusted_serving_weight',
      multiplier: basisUnits / input.basisQuantity,
      resolvedWeightGrams: requestedWeight,
      resolvedVolumeMl: null,
    };
  }

  if (
    input.requestUnit.family === 'volume' &&
    option.equivalentVolumeMl !== null
  ) {
    const requestedVolume = millilitresFor(
      input.requestQuantity,
      input.requestUnit.unit,
    );
    if (requestedVolume === null) return null;
    const basisUnits =
      (requestedVolume / option.equivalentVolumeMl) * option.option.quantity;
    return {
      reason: 'trusted_serving_volume',
      multiplier: basisUnits / input.basisQuantity,
      resolvedWeightGrams: null,
      resolvedVolumeMl: requestedVolume,
    };
  }

  return null;
}

export function resolveServingRequest(
  input: ServingResolutionInput,
): ServingResolution {
  const requestedQuantity = validateServingQuantity(input.request.quantity);
  const requestUnit = classifyServingUnit(input.request.unit);
  const basisQuantity = validateServingQuantity(input.basis.quantity);
  const basisUnit = classifyServingUnit(input.basis.unit);

  if (!requestedQuantity.success) {
    return resolution(
      input,
      requestUnit,
      basisUnit,
      'invalid',
      'invalid_quantity',
    );
  }

  if (requestUnit === null) {
    return resolution(
      input,
      requestUnit,
      basisUnit,
      'invalid',
      'unsupported_unit',
    );
  }

  if (!basisQuantity.success || basisUnit === null) {
    return resolution(
      input,
      requestUnit,
      basisUnit,
      'invalid',
      'invalid_basis',
    );
  }

  const servingOptions = input.servingOptions ?? [];
  const requestedOptionId = input.request.servingOptionId;
  let selectedOption: ValidServingOption | null = null;

  if (requestedOptionId !== undefined && requestedOptionId !== null) {
    const selectedMatches = servingOptions.filter(
      (option) => option.id === requestedOptionId,
    );
    if (selectedMatches.length !== 1 || selectedMatches[0] === undefined) {
      return resolution(
        input,
        requestUnit,
        basisUnit,
        'invalid',
        'invalid_serving_option',
      );
    }

    selectedOption = validServingOption(selectedMatches[0]);
    if (selectedOption === null) {
      return resolution(
        input,
        requestUnit,
        basisUnit,
        'invalid',
        'invalid_serving_option',
      );
    }
  }

  const canResolveWithoutOption =
    requestUnit.unit === basisUnit.unit ||
    (requestUnit.family === 'mass' && basisUnit.family === 'mass') ||
    (requestUnit.family === 'volume' && basisUnit.family === 'volume');
  if (
    selectedOption !== null &&
    canResolveWithoutOption &&
    selectedOption.unit.unit !== requestUnit.unit &&
    selectedOption.unit.unit !== basisUnit.unit
  ) {
    return resolution(
      input,
      requestUnit,
      basisUnit,
      'invalid',
      'invalid_serving_option',
    );
  }

  if (requestUnit.unit === basisUnit.unit) {
    const multiplier = calculateServingMultiplier({
      requestedQuantity: requestedQuantity.quantity,
      basisQuantity: basisQuantity.quantity,
      directlyCompatible: true,
    });
    if (!multiplier.success) {
      return resolution(
        input,
        requestUnit,
        basisUnit,
        'invalid',
        'invalid_quantity',
      );
    }

    return resolution(
      input,
      requestUnit,
      basisUnit,
      'exact',
      requestUnit.family === 'count' ? 'direct_count_basis' : 'same_basis',
      {
        multiplier: multiplier.multiplier,
        resolvedWeightGrams: gramsFor(
          requestedQuantity.quantity,
          requestUnit.unit,
        ),
        resolvedVolumeMl: millilitresFor(
          requestedQuantity.quantity,
          requestUnit.unit,
        ),
      },
    );
  }

  if (requestUnit.family === 'mass' && basisUnit.family === 'mass') {
    const requestedWeight = gramsFor(
      requestedQuantity.quantity,
      requestUnit.unit,
    );
    const basisWeight = gramsFor(basisQuantity.quantity, basisUnit.unit);
    const multiplier =
      requestedWeight === null || basisWeight === null
        ? null
        : requestedWeight / basisWeight;
    if (
      requestedWeight === null ||
      basisWeight === null ||
      basisWeight <= 0 ||
      multiplier === null ||
      !Number.isFinite(multiplier)
    ) {
      return resolution(
        input,
        requestUnit,
        basisUnit,
        'invalid',
        'invalid_basis',
      );
    }

    return resolution(
      input,
      requestUnit,
      basisUnit,
      'converted',
      'standard_mass_conversion',
      {
        multiplier,
        resolvedWeightGrams: requestedWeight,
      },
    );
  }

  if (requestUnit.family === 'volume' && basisUnit.family === 'volume') {
    const requestedVolume = millilitresFor(
      requestedQuantity.quantity,
      requestUnit.unit,
    );
    const basisVolume = millilitresFor(basisQuantity.quantity, basisUnit.unit);
    const multiplier =
      requestedVolume === null || basisVolume === null
        ? null
        : requestedVolume / basisVolume;
    if (
      requestedVolume === null ||
      basisVolume === null ||
      basisVolume <= 0 ||
      multiplier === null ||
      !Number.isFinite(multiplier)
    ) {
      return resolution(
        input,
        requestUnit,
        basisUnit,
        'invalid',
        'invalid_basis',
      );
    }

    return resolution(
      input,
      requestUnit,
      basisUnit,
      'converted',
      'standard_volume_conversion',
      {
        multiplier,
        resolvedVolumeMl: requestedVolume,
      },
    );
  }

  let candidateOptions: ValidServingOption[];
  if (selectedOption !== null) {
    if (!optionCanResolve(selectedOption, requestUnit, basisUnit)) {
      return resolution(
        input,
        requestUnit,
        basisUnit,
        'invalid',
        'invalid_serving_option',
      );
    }
    candidateOptions = [selectedOption];
  } else {
    const validOptions = servingOptions.map(validServingOption);
    if (validOptions.some((option) => option === null)) {
      return resolution(
        input,
        requestUnit,
        basisUnit,
        'invalid',
        'invalid_serving_option',
      );
    }

    candidateOptions = (validOptions as ValidServingOption[]).filter((option) =>
      optionCanResolve(option, requestUnit, basisUnit),
    );
  }

  if (candidateOptions.length > 1) {
    return resolution(
      input,
      requestUnit,
      basisUnit,
      'needs_review',
      'ambiguous_serving_option',
      { servingOptionId: null },
    );
  }

  const servingOption = candidateOptions[0];
  if (servingOption !== undefined) {
    const converted = resolvedFromOption({
      requestQuantity: requestedQuantity.quantity,
      requestUnit,
      basisQuantity: basisQuantity.quantity,
      basisUnit,
      servingOption,
    });
    if (
      converted === null ||
      !Number.isFinite(converted.multiplier) ||
      converted.multiplier <= 0
    ) {
      return resolution(
        input,
        requestUnit,
        basisUnit,
        'invalid',
        'invalid_serving_option',
      );
    }

    return resolution(
      input,
      requestUnit,
      basisUnit,
      'converted',
      converted.reason,
      {
        servingOptionId: servingOption.option.id,
        multiplier: converted.multiplier,
        resolvedWeightGrams: converted.resolvedWeightGrams,
        resolvedVolumeMl: converted.resolvedVolumeMl,
      },
    );
  }

  if (requestUnit.family === 'household') {
    return resolution(
      input,
      requestUnit,
      basisUnit,
      'needs_review',
      'unknown_household_unit',
    );
  }

  if (requestUnit.family === 'count' && basisUnit.family === 'count') {
    return resolution(
      input,
      requestUnit,
      basisUnit,
      'needs_review',
      'missing_conversion',
    );
  }

  return resolution(
    input,
    requestUnit,
    basisUnit,
    'needs_review',
    'incompatible_unit',
  );
}
